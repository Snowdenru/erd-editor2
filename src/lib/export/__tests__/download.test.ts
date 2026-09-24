import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyText, downloadText } from '../download';

describe('downloadText', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('creates a blob link with the file name and clicks it', () => {
        const click = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => undefined);
        let seen: { download: string; href: string } | undefined;
        click.mockImplementation(function (this: HTMLAnchorElement) {
            seen = { download: this.download, href: this.href };
        });

        downloadText('shop.sql', 'SELECT 1;');

        expect(seen).toEqual({ download: 'shop.sql', href: 'blob:test' });
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const blob = createObjectURL.mock.calls[0][0];
        expect(blob.type).toBe('text/plain;charset=utf-8');
        vi.advanceTimersByTime(1000);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
});

const setClipboard = (clipboard: unknown) =>
    Object.defineProperty(navigator, 'clipboard', {
        value: clipboard,
        configurable: true,
    });

describe('copyText', () => {
    it('returns true when the clipboard accepts the text', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        setClipboard({ writeText });
        expect(await copyText('abc')).toBe(true);
        expect(writeText).toHaveBeenCalledWith('abc');
    });

    it('returns false when the clipboard rejects or is missing', async () => {
        setClipboard({
            writeText: vi.fn().mockRejectedValue(new Error('no')),
        });
        expect(await copyText('abc')).toBe(false);
        setClipboard(undefined);
        expect(await copyText('abc')).toBe(false);
    });
});
