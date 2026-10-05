import React, { useCallback, useMemo, useEffect, useState } from 'react';
import type { ExportImageContext, ImageType } from './export-image-context';
import { exportImageContext } from './export-image-context';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { useReactFlow } from '@xyflow/react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useTheme } from '@/hooks/use-theme';
import logoDark from '@/assets/sqllab-logo-dark.svg';
import logoLight from '@/assets/sqllab-logo-light.svg';
import type { EffectiveTheme } from '../theme-context/theme-context';
import { exportFileName } from '@/lib/export/file-name';

// html-to-image иногда не возвращает управление (картинка/foreignObject не
// загрузились) - без таймаута полноэкранный лоадер висел бы вечно.
const SNAPSHOT_TIMEOUT_MS = 60_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error('Image export timed out')),
            ms
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });

// skipFonts отключает обработку CSS в html-to-image, поэтому стили линий связей
// и маркеров (стрелки, "1"/"N") вписываем прямо в элементы на время снимка -
// иначе на картинке связей не видно. Возвращает функцию отката.
const inlineRelationStyles = (viewportElement: HTMLElement): (() => void) => {
    const restores: (() => void)[] = [];

    document
        .querySelectorAll<SVGElement>(
            '.marker-definitions marker circle, .marker-definitions marker text'
        )
        .forEach((element) => {
            const computed = window.getComputedStyle(element);
            const { fill, stroke } = element.style;
            element.style.fill = computed.fill;
            if (element.tagName.toLowerCase() === 'circle') {
                element.style.stroke = computed.stroke;
            }
            restores.push(() => {
                element.style.fill = fill;
                element.style.stroke = stroke;
            });
        });

    viewportElement
        .querySelectorAll<SVGPathElement>('.react-flow__edge-path')
        .forEach((path) => {
            const computed = window.getComputedStyle(path);
            const { stroke, strokeWidth } = path.style;
            path.style.stroke = computed.stroke;
            path.style.strokeWidth = computed.strokeWidth;
            restores.push(() => {
                path.style.stroke = stroke;
                path.style.strokeWidth = strokeWidth;
            });
        });

    return () => restores.forEach((restore) => restore());
};

export const ExportImageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { hideLoader, showLoader } = useFullScreenLoader();
    const { setNodes, getViewport } = useReactFlow();
    const { effectiveTheme } = useTheme();
    const { diagramName } = useChartDB();
    const [logoBase64, setLogoBase64] = useState<string>('');

    useEffect(() => {
        // Convert logo to base64 on component mount
        const img = new Image();
        img.src = effectiveTheme === 'light' ? logoLight : logoDark;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const base64 = canvas.toDataURL('image/png');
                setLogoBase64(base64);
            }
        };
    }, [effectiveTheme]);

    const downloadImage = useCallback(
        (dataUrl: string, type: ImageType) => {
            const extension = type === 'jpeg' ? 'jpg' : type;
            const a = document.createElement('a');
            a.setAttribute('download', exportFileName(diagramName, extension));
            a.setAttribute('href', dataUrl);
            a.click();
        },
        [diagramName]
    );

    const imageCreatorMap: Record<
        ImageType,
        typeof toJpeg | typeof toPng | typeof toSvg
    > = useMemo(
        () => ({
            jpeg: toJpeg,
            png: toPng,
            svg: toSvg,
        }),
        []
    );

    const getBackgroundColor = useCallback(
        (theme: EffectiveTheme, transparent: boolean): string => {
            if (transparent) return 'transparent';
            return theme === 'light' ? '#ffffff' : '#141414';
        },
        []
    );

    const exportImage: ExportImageContext['exportImage'] = useCallback(
        (type, { includePatternBG, transparent, scale }) => {
            showLoader({
                animated: false,
            });

            setNodes((nodes) =>
                nodes.map((node) => ({ ...node, selected: false }))
            );

            const viewport = getViewport();
            const reactFlowBounds = document
                .querySelector('.react-flow')
                ?.getBoundingClientRect();

            if (!reactFlowBounds) {
                console.error('Could not find React Flow container');
                hideLoader();
                return Promise.reject(
                    new Error('Could not find React Flow container')
                );
            }

            const imageCreateFn = imageCreatorMap[type];

            // The heavy lifting (DOM snapshot, watermark compositing, download)
            // is scheduled on the next tick so the browser can paint the
            // loader/deselected-nodes state first. We wrap that setTimeout
            // body in a promise and only resolve/reject it once the work has
            // actually finished (or failed), so callers can `await
            // exportImage(...)` and learn the real outcome instead of the
            // promise resolving immediately while the export is still
            // in flight.
            return new Promise<void>((resolve, reject) => {
                setTimeout(() => {
                    (async () => {
                        const viewportElement = window.document.querySelector(
                            '.react-flow__viewport'
                        ) as HTMLElement;

                        const markerDefs = document.querySelector(
                            '.marker-definitions defs'
                        );

                        const tempSvg = document.createElementNS(
                            'http://www.w3.org/2000/svg',
                            'svg'
                        );
                        tempSvg.style.position = 'absolute';
                        tempSvg.style.top = '0';
                        tempSvg.style.left = '0';
                        tempSvg.style.width = '100%';
                        tempSvg.style.height = '100%';
                        tempSvg.style.overflow = 'visible';
                        tempSvg.style.zIndex = '-50';
                        tempSvg.setAttribute(
                            'viewBox',
                            `0 0 ${reactFlowBounds.width} ${reactFlowBounds.height}`
                        );

                        const defs = document.createElementNS(
                            'http://www.w3.org/2000/svg',
                            'defs'
                        );

                        // Inline styles for marker elements before copying since skipFonts: true prevents CSS processing
                        const markerCircles = document.querySelectorAll(
                            '.marker-definitions marker circle'
                        ) as NodeListOf<SVGCircleElement>;
                        const markerTexts = document.querySelectorAll(
                            '.marker-definitions marker text'
                        ) as NodeListOf<SVGTextElement>;

                        const originalMarkerStyles: {
                            element: SVGElement;
                            fill: string;
                            stroke: string;
                        }[] = [];

                        markerCircles.forEach((circle) => {
                            const computedStyle =
                                window.getComputedStyle(circle);
                            originalMarkerStyles.push({
                                element: circle,
                                fill: circle.style.fill,
                                stroke: circle.style.stroke,
                            });
                            circle.style.fill = computedStyle.fill;
                            circle.style.stroke = computedStyle.stroke;
                        });

                        markerTexts.forEach((text) => {
                            const computedStyle = window.getComputedStyle(text);
                            originalMarkerStyles.push({
                                element: text,
                                fill: text.style.fill,
                                stroke: text.style.stroke,
                            });
                            text.style.fill = computedStyle.fill;
                        });

                        if (markerDefs) {
                            defs.innerHTML = markerDefs.innerHTML;
                        }

                        // Restore original marker styles
                        originalMarkerStyles.forEach(
                            ({ element, fill, stroke }) => {
                                element.style.fill = fill;
                                element.style.stroke = stroke;
                            }
                        );

                        if (includePatternBG) {
                            const pattern = document.createElementNS(
                                'http://www.w3.org/2000/svg',
                                'pattern'
                            );
                            pattern.setAttribute('id', 'background-pattern');
                            pattern.setAttribute(
                                'width',
                                String(16 * viewport.zoom)
                            );
                            pattern.setAttribute(
                                'height',
                                String(16 * viewport.zoom)
                            );
                            pattern.setAttribute(
                                'patternUnits',
                                'userSpaceOnUse'
                            );
                            pattern.setAttribute(
                                'patternTransform',
                                `translate(${viewport.x % (16 * viewport.zoom)} ${viewport.y % (16 * viewport.zoom)})`
                            );

                            const dot = document.createElementNS(
                                'http://www.w3.org/2000/svg',
                                'circle'
                            );

                            const dotSize = viewport.zoom * 0.5;
                            dot.setAttribute('cx', String(viewport.zoom));
                            dot.setAttribute('cy', String(viewport.zoom));
                            dot.setAttribute('r', String(dotSize));
                            const dotColor =
                                effectiveTheme === 'light'
                                    ? '#92939C'
                                    : '#777777';
                            dot.setAttribute('fill', dotColor);

                            pattern.appendChild(dot);
                            defs.appendChild(pattern);
                        }

                        tempSvg.appendChild(defs);

                        const backgroundRect = document.createElementNS(
                            'http://www.w3.org/2000/svg',
                            'rect'
                        );
                        const bgPadding = 2000;
                        backgroundRect.setAttribute(
                            'x',
                            String(-viewport.x - bgPadding)
                        );
                        backgroundRect.setAttribute(
                            'y',
                            String(-viewport.y - bgPadding)
                        );
                        backgroundRect.setAttribute(
                            'width',
                            String(reactFlowBounds.width + 2 * bgPadding)
                        );
                        backgroundRect.setAttribute(
                            'height',
                            String(reactFlowBounds.height + 2 * bgPadding)
                        );
                        backgroundRect.setAttribute(
                            'fill',
                            'url(#background-pattern)'
                        );
                        tempSvg.appendChild(backgroundRect);

                        viewportElement.insertBefore(
                            tempSvg,
                            viewportElement.firstChild
                        );

                        // Inline stroke styles for edge paths since skipFonts: true prevents CSS processing
                        const edgePaths = viewportElement.querySelectorAll(
                            '.react-flow__edge-path'
                        ) as NodeListOf<SVGPathElement>;
                        const originalStyles: {
                            element: SVGPathElement;
                            stroke: string;
                            strokeWidth: string;
                        }[] = [];

                        edgePaths.forEach((path) => {
                            const computedStyle = window.getComputedStyle(path);
                            originalStyles.push({
                                element: path,
                                stroke: path.style.stroke,
                                strokeWidth: path.style.strokeWidth,
                            });
                            path.style.stroke = computedStyle.stroke;
                            path.style.strokeWidth = computedStyle.strokeWidth;
                        });

                        try {
                            // Handle SVG export differently
                            if (type === 'svg') {
                                const dataUrl = await withTimeout(
                                    imageCreateFn(viewportElement, {
                                        width: reactFlowBounds.width,
                                        height: reactFlowBounds.height,
                                        style: {
                                            width: `${reactFlowBounds.width}px`,
                                            height: `${reactFlowBounds.height}px`,
                                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                                        },
                                        quality: 1,
                                        pixelRatio: scale,
                                        skipFonts: true,
                                    }),
                                    SNAPSHOT_TIMEOUT_MS
                                );
                                downloadImage(dataUrl, type);
                                return;
                            }

                            // For PNG and JPEG, continue with the watermark process
                            const initialDataUrl = await withTimeout(
                                imageCreateFn(viewportElement, {
                                    backgroundColor: getBackgroundColor(
                                        effectiveTheme,
                                        transparent
                                    ),
                                    width: reactFlowBounds.width,
                                    height: reactFlowBounds.height,
                                    style: {
                                        width: `${reactFlowBounds.width}px`,
                                        height: `${reactFlowBounds.height}px`,
                                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                                    },
                                    quality: 1,
                                    pixelRatio: scale,
                                    skipFonts: true,
                                }),
                                SNAPSHOT_TIMEOUT_MS
                            );

                            // Create a canvas to combine the diagram and watermark
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');

                            if (!ctx) {
                                downloadImage(initialDataUrl, type);
                                return;
                            }

                            // Set canvas size to match the export size
                            canvas.width = reactFlowBounds.width * scale;
                            canvas.height = reactFlowBounds.height * scale;

                            // Load the exported diagram
                            const diagramImage = new Image();
                            diagramImage.src = initialDataUrl;

                            await new Promise<void>(
                                (resolveDiagram, rejectDiagram) => {
                                    diagramImage.onload = () => {
                                        (async () => {
                                            // Draw the diagram
                                            ctx.drawImage(diagramImage, 0, 0);

                                            // Calculate logo size
                                            const logoHeight = Math.max(
                                                24,
                                                Math.floor(canvas.width * 0.024)
                                            );
                                            const padding = Math.max(
                                                12,
                                                Math.floor(logoHeight * 0.5)
                                            );

                                            // Load and draw the logo
                                            const logoImage = new Image();
                                            logoImage.src = logoBase64;

                                            await new Promise<void>(
                                                (resolveLogo, rejectLogo) => {
                                                    logoImage.onload = () => {
                                                        // Calculate logo width while maintaining aspect ratio
                                                        const logoWidth =
                                                            (logoImage.width /
                                                                logoImage.height) *
                                                            logoHeight;

                                                        // Draw logo in bottom-left corner
                                                        ctx.globalAlpha = 0.9;
                                                        ctx.drawImage(
                                                            logoImage,
                                                            padding,
                                                            canvas.height -
                                                                logoHeight -
                                                                padding,
                                                            logoWidth,
                                                            logoHeight
                                                        );
                                                        ctx.globalAlpha = 1;
                                                        resolveLogo();
                                                    };
                                                    logoImage.onerror = () => {
                                                        rejectLogo(
                                                            new Error(
                                                                'Failed to load logo image for watermark'
                                                            )
                                                        );
                                                    };
                                                }
                                            );

                                            // Convert canvas to data URL
                                            const finalDataUrl =
                                                canvas.toDataURL(
                                                    type === 'png'
                                                        ? 'image/png'
                                                        : 'image/jpeg'
                                                );
                                            downloadImage(finalDataUrl, type);
                                            resolveDiagram();
                                        })().catch(rejectDiagram);
                                    };
                                    diagramImage.onerror = () => {
                                        rejectDiagram(
                                            new Error(
                                                'Failed to load the rendered diagram image'
                                            )
                                        );
                                    };
                                }
                            );
                        } finally {
                            // Restore original styles
                            originalStyles.forEach(
                                ({ element, stroke, strokeWidth }) => {
                                    element.style.stroke = stroke;
                                    element.style.strokeWidth = strokeWidth;
                                }
                            );
                            viewportElement.removeChild(tempSvg);
                            hideLoader();
                        }
                    })().then(resolve, reject);
                }, 0);
            });
        },
        [
            getBackgroundColor,
            downloadImage,
            getViewport,
            hideLoader,
            imageCreatorMap,
            setNodes,
            showLoader,
            effectiveTheme,
            logoBase64,
        ]
    );

    // Lightweight sibling of exportImage: same DOM snapshot, but skips the
    // watermark canvas compositing and download side effect so it's fast
    // enough to re-run on every option change for a live preview. Renders
    // at pixelRatio 1 regardless of the export scale the user picked, since
    // a thumbnail doesn't need full export resolution.
    const previewImage = useCallback(
        async (
            type: ImageType,
            {
                includePatternBG,
                transparent,
            }: { includePatternBG: boolean; transparent: boolean }
        ): Promise<string> => {
            const viewportElement = window.document.querySelector(
                '.react-flow__viewport'
            ) as HTMLElement | null;
            const reactFlowBounds = document
                .querySelector('.react-flow')
                ?.getBoundingClientRect();

            if (!viewportElement || !reactFlowBounds) {
                throw new Error('Could not find React Flow container');
            }

            const viewport = getViewport();
            const imageCreateFn = imageCreatorMap[type];

            // Маркеры связей живут вне .react-flow__viewport, а снимаем мы только его:
            // кладём их копию внутрь, как это делает exportImage
            const markerDefs = document.querySelector(
                '.marker-definitions defs'
            );
            const restoreRelationStyles = inlineRelationStyles(viewportElement);
            let markerOverlay: SVGSVGElement | null = null;
            if (markerDefs) {
                markerOverlay = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'svg'
                );
                markerOverlay.style.position = 'absolute';
                markerOverlay.style.top = '0';
                markerOverlay.style.left = '0';
                markerOverlay.style.width = '100%';
                markerOverlay.style.height = '100%';
                markerOverlay.style.overflow = 'visible';
                markerOverlay.style.zIndex = '-50';
                markerOverlay.setAttribute(
                    'viewBox',
                    `0 0 ${reactFlowBounds.width} ${reactFlowBounds.height}`
                );
                const markerDefsCopy = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'defs'
                );
                markerDefsCopy.innerHTML = markerDefs.innerHTML;
                markerOverlay.appendChild(markerDefsCopy);
                viewportElement.insertBefore(
                    markerOverlay,
                    viewportElement.firstChild
                );
            }

            let patternOverlay: SVGSVGElement | null = null;
            if (includePatternBG) {
                patternOverlay = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'svg'
                );
                patternOverlay.style.position = 'absolute';
                patternOverlay.style.top = '0';
                patternOverlay.style.left = '0';
                patternOverlay.style.width = '100%';
                patternOverlay.style.height = '100%';
                patternOverlay.style.overflow = 'visible';
                patternOverlay.style.zIndex = '-50';
                patternOverlay.setAttribute(
                    'viewBox',
                    `0 0 ${reactFlowBounds.width} ${reactFlowBounds.height}`
                );

                const defs = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'defs'
                );
                const pattern = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'pattern'
                );
                pattern.setAttribute('id', 'preview-background-pattern');
                pattern.setAttribute('width', String(16 * viewport.zoom));
                pattern.setAttribute('height', String(16 * viewport.zoom));
                pattern.setAttribute('patternUnits', 'userSpaceOnUse');
                pattern.setAttribute(
                    'patternTransform',
                    `translate(${viewport.x % (16 * viewport.zoom)} ${viewport.y % (16 * viewport.zoom)})`
                );
                const dot = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'circle'
                );
                const dotSize = viewport.zoom * 0.5;
                dot.setAttribute('cx', String(viewport.zoom));
                dot.setAttribute('cy', String(viewport.zoom));
                dot.setAttribute('r', String(dotSize));
                dot.setAttribute(
                    'fill',
                    effectiveTheme === 'light' ? '#92939C' : '#777777'
                );
                pattern.appendChild(dot);
                defs.appendChild(pattern);
                patternOverlay.appendChild(defs);

                const backgroundRect = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'rect'
                );
                const bgPadding = 2000;
                backgroundRect.setAttribute(
                    'x',
                    String(-viewport.x - bgPadding)
                );
                backgroundRect.setAttribute(
                    'y',
                    String(-viewport.y - bgPadding)
                );
                backgroundRect.setAttribute(
                    'width',
                    String(reactFlowBounds.width + 2 * bgPadding)
                );
                backgroundRect.setAttribute(
                    'height',
                    String(reactFlowBounds.height + 2 * bgPadding)
                );
                backgroundRect.setAttribute(
                    'fill',
                    'url(#preview-background-pattern)'
                );
                patternOverlay.appendChild(backgroundRect);

                viewportElement.insertBefore(
                    patternOverlay,
                    viewportElement.firstChild
                );
            }

            const baseOptions = {
                width: reactFlowBounds.width,
                height: reactFlowBounds.height,
                style: {
                    width: `${reactFlowBounds.width}px`,
                    height: `${reactFlowBounds.height}px`,
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                },
                quality: 1,
                pixelRatio: 1,
                skipFonts: true,
            };

            try {
                return await withTimeout(
                    imageCreateFn(
                        viewportElement,
                        type === 'svg'
                            ? baseOptions
                            : {
                                  ...baseOptions,
                                  backgroundColor: getBackgroundColor(
                                      effectiveTheme,
                                      transparent
                                  ),
                              }
                    ),
                    SNAPSHOT_TIMEOUT_MS
                );
            } finally {
                restoreRelationStyles();
                if (markerOverlay) {
                    viewportElement.removeChild(markerOverlay);
                }
                if (patternOverlay) {
                    viewportElement.removeChild(patternOverlay);
                }
            }
        },
        [effectiveTheme, getBackgroundColor, getViewport, imageCreatorMap]
    );

    return (
        <exportImageContext.Provider value={{ exportImage, previewImage }}>
            {children}
        </exportImageContext.Provider>
    );
};
