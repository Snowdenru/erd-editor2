import { createContext } from 'react';
import { emptyFn } from '@/lib/utils';

export type ImageType = 'png' | 'jpeg' | 'svg';
export interface ExportImageContext {
    exportImage: (
        type: ImageType,
        options: {
            includePatternBG: boolean;
            transparent: boolean;
            scale: number;
        }
    ) => Promise<void>;
    // Renders the same diagram snapshot as exportImage (without the
    // watermark compositing step, a fixed pixelRatio, or triggering a
    // download) so callers can show a live "what you'll get" thumbnail.
    previewImage: (
        type: ImageType,
        options: {
            includePatternBG: boolean;
            transparent: boolean;
        }
    ) => Promise<string>;
}

export const exportImageContext = createContext<ExportImageContext>({
    exportImage: emptyFn,
    previewImage: () =>
        Promise.reject(new Error('ExportImageProvider is not mounted')),
});
