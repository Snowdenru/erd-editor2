import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    isStaleChunkError,
    reloadOnceForStaleChunk,
} from '../reload-on-stale-chunk';

describe('isStaleChunkError', () => {
    it('распознаёт ошибки загрузки устаревшего чанка в разных браузерах', () => {
        expect(
            isStaleChunkError(
                new TypeError(
                    'Failed to fetch dynamically imported module: https://x/assets/a.js'
                )
            )
        ).toBe(true);
        expect(
            isStaleChunkError(
                new TypeError('Importing a module script failed.')
            )
        ).toBe(true);
        expect(
            isStaleChunkError(
                new Error('error loading dynamically imported module')
            )
        ).toBe(true);
    });

    it('не путает обычные ошибки с устаревшим чанком', () => {
        expect(isStaleChunkError(new Error('Cannot read properties'))).toBe(
            false
        );
        expect(isStaleChunkError(undefined)).toBe(false);
    });
});

describe('reloadOnceForStaleChunk', () => {
    const reload = vi.fn();

    beforeEach(() => {
        sessionStorage.clear();
        reload.mockClear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, reload },
        });
    });

    it('перезагружает страницу первый раз', () => {
        expect(reloadOnceForStaleChunk()).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('не зацикливает перезагрузку, если ошибка повторилась сразу после неё', () => {
        reloadOnceForStaleChunk();
        expect(reloadOnceForStaleChunk()).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
