// src/components/export-dialog/image-tab.tsx
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/button/button';
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

export interface ImageTabProps {
    onExported: (info: ExportedInfo) => void;
}

export const ImageTab: React.FC<ImageTabProps> = ({ onExported }) => {
    const { exportImage } = useExportImage();
    const [format, setFormat] = useState<ImageFormat>('png');
    const [scale, setScale] = useState(2);
    const [transparent, setTransparent] = useState(false);
    const [grid, setGrid] = useState(false);
    const [busy, setBusy] = useState(false);

    const isVector = format === 'svg';
    const canBeTransparent = format !== 'jpeg';

    const handleDownload = async () => {
        setBusy(true);
        try {
            await exportImage(format, {
                scale: isVector ? 1 : scale,
                transparent: canBeTransparent && transparent,
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
        <div className="space-y-5">
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
                        SVG — векторный формат, масштаб не нужен: картинка не
                        теряет чёткость.
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
                            checked={canBeTransparent && transparent}
                            disabled={!canBeTransparent}
                            onChange={(e) => setTransparent(e.target.checked)}
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
    );
};
