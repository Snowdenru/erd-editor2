// src/components/export-dialog/image-tab.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { useExportImage } from '@/hooks/use-export-image';
import { cn } from '@/lib/utils';
import type { ExportedInfo } from './export-dialog';

type ImageFormat = 'png' | 'jpeg' | 'svg';

const FORMATS: { id: ImageFormat; label: string }[] = [
    { id: 'png', label: 'PNG' },
    { id: 'jpeg', label: 'JPG' },
    { id: 'svg', label: 'SVG' },
];
const SCALES = [1, 2, 3];

const optionClass = (active: boolean) =>
    cn(
        'rounded-md border px-4 py-2 text-sm transition-colors',
        active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'hover:bg-accent'
    );

// CSS checkerboard, purely to make a transparent background visible in the
// preview - it's never part of the exported image itself.
const checkerboardStyle: React.CSSProperties = {
    backgroundImage:
        'linear-gradient(45deg, #8884 25%, transparent 25%), linear-gradient(-45deg, #8884 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #8884 75%), linear-gradient(-45deg, transparent 75%, #8884 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
};

export interface ImageTabProps {
    onExported: (info: ExportedInfo) => void;
}

export const ImageTab: React.FC<ImageTabProps> = ({ onExported }) => {
    const { exportImage, previewImage } = useExportImage();
    const [format, setFormat] = useState<ImageFormat>('png');
    const [scale, setScale] = useState(2);
    const [transparent, setTransparent] = useState(false);
    const [grid, setGrid] = useState(false);
    const [busy, setBusy] = useState(false);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const previewRequestId = useRef(0);

    const isVector = format === 'svg';
    const canBeTransparent = format !== 'jpeg';
    const effectiveTransparent = canBeTransparent && transparent;

    useEffect(() => {
        const requestId = ++previewRequestId.current;
        setPreviewLoading(true);
        const timer = setTimeout(() => {
            previewImage(format, {
                transparent: effectiveTransparent,
                includePatternBG: grid,
            })
                .then((dataUrl) => {
                    if (previewRequestId.current !== requestId) return;
                    setPreviewUrl(dataUrl);
                    setPreviewError(null);
                })
                .catch(() => {
                    if (previewRequestId.current !== requestId) return;
                    setPreviewError('Не удалось сформировать превью');
                })
                .finally(() => {
                    if (previewRequestId.current !== requestId) return;
                    setPreviewLoading(false);
                });
        }, 250);
        return () => clearTimeout(timer);
    }, [format, effectiveTransparent, grid, previewImage]);

    const handleDownload = async () => {
        setBusy(true);
        try {
            await exportImage(format, {
                scale: isVector ? 1 : scale,
                transparent: effectiveTransparent,
                includePatternBG: grid,
            });
            onExported({
                format: format === 'jpeg' ? 'jpg' : format,
                action: 'download',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 gap-5">
            <div className="w-56 shrink-0 space-y-5 overflow-auto">
                <div>
                    <p className="mb-2 text-sm font-medium">Формат</p>
                    <div className="flex gap-2">
                        {FORMATS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={format === id}
                                className={optionClass(format === id)}
                                onClick={() => setFormat(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {isVector && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            SVG — векторный формат, масштаб не нужен: картинка
                            не теряет чёткость.
                        </p>
                    )}
                </div>

                {!isVector && (
                    <div>
                        <p className="mb-2 text-sm font-medium">Масштаб</p>
                        <div className="flex gap-2">
                            {SCALES.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={scale === value}
                                    className={optionClass(scale === value)}
                                    onClick={() => setScale(value)}
                                >
                                    {value}×
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2 text-sm">
                    {!isVector && (
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={effectiveTransparent}
                                disabled={!canBeTransparent}
                                onChange={(e) =>
                                    setTransparent(e.target.checked)
                                }
                            />
                            Прозрачный фон
                        </label>
                    )}
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={grid}
                            onChange={(e) => setGrid(e.target.checked)}
                        />
                        Сетка на фоне
                    </label>
                </div>

                <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDownload()}
                >
                    <Download /> Скачать
                </Button>
            </div>

            <div
                className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
                style={
                    effectiveTransparent && !isVector
                        ? checkerboardStyle
                        : undefined
                }
            >
                {previewError ? (
                    <p className="p-4 text-sm text-destructive">
                        {previewError}
                    </p>
                ) : previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Предпросмотр схемы"
                        className="max-h-full max-w-full object-contain"
                    />
                ) : null}
                {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                        <Spinner />
                    </div>
                )}
            </div>
        </div>
    );
};
