// src/components/export-dialog/image-tab.tsx
import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { useExportImage } from '@/hooks/use-export-image';
import { useTheme } from '@/hooks/use-theme';
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

// Точки сетки в превью: приблизительные (шаг не зависит от масштаба холста),
// в самой скачанной картинке сетка строится точно по масштабу.
const gridOverlayStyle = (theme: string): React.CSSProperties => ({
    backgroundImage: `radial-gradient(circle, ${
        theme === 'light' ? '#92939C' : '#777777'
    } 0.8px, transparent 1px)`,
    backgroundSize: '16px 16px',
});

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
    const [downloadError, setDownloadError] = useState(false);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(true);
    const { effectiveTheme } = useTheme();

    const isVector = format === 'svg';
    const canBeTransparent = format !== 'jpeg';
    const effectiveTransparent = canBeTransparent && transparent;

    // Снимок схемы блокирует страницу на секунды (html-to-image работает в
    // главном потоке), поэтому превью строим ОДИН раз при открытии вкладки:
    // без фона и без сетки. Прозрачность, фон и сетку показываем поверх
    // картинки средствами CSS - смена опций больше не запускает новый снимок.
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            previewImage('png', { transparent: true, includePatternBG: false })
                .then((dataUrl) => {
                    if (cancelled) return;
                    setPreviewUrl(dataUrl);
                    setPreviewError(null);
                })
                .catch(() => {
                    if (cancelled) return;
                    setPreviewError('Не удалось сформировать превью');
                })
                .finally(() => {
                    if (cancelled) return;
                    setPreviewLoading(false);
                });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [previewImage]);

    // Фон превью повторяет фон файла: прозрачный - шашечки, иначе цвет темы.
    // SVG выгружается без фона, как и раньше.
    const previewBackground: React.CSSProperties | undefined = isVector
        ? undefined
        : effectiveTransparent
          ? checkerboardStyle
          : {
                backgroundColor:
                    effectiveTheme === 'light' ? '#ffffff' : '#141414',
            };

    const handleDownload = async () => {
        setBusy(true);
        setDownloadError(false);
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
        } catch {
            setDownloadError(true);
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
                    disabled={busy || previewLoading}
                    onClick={() => void handleDownload()}
                >
                    <Download /> Скачать
                </Button>
                {downloadError && (
                    <p className="text-xs text-destructive">
                        Не удалось сохранить изображение. Попробуйте ещё раз или
                        выберите SVG.
                    </p>
                )}
            </div>

            <div
                className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
                style={previewBackground}
            >
                {previewError ? (
                    <p className="p-4 text-sm text-destructive">
                        {previewError}
                    </p>
                ) : previewUrl ? (
                    <div className="relative max-h-full max-w-full">
                        <img
                            src={previewUrl}
                            alt="Предпросмотр схемы"
                            className="block max-h-full max-w-full object-contain"
                        />
                        {grid && (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0"
                                style={gridOverlayStyle(effectiveTheme)}
                            />
                        )}
                    </div>
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
