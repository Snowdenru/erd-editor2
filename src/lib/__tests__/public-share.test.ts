import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyPalette,
    fetchPublicDiagram,
    isPublicTheme,
    PUBLIC_THEMES,
    resolveTheme,
    themeMode,
} from '../public-share';

describe('public-share: темы', () => {
    it('пять пресетов', () => {
        expect(PUBLIC_THEMES).toEqual([
            'light',
            'dark',
            'palette-blue',
            'palette-green',
            'palette-violet',
        ]);
    });

    it('isPublicTheme отсекает мусор', () => {
        expect(isPublicTheme('dark')).toBe(true);
        expect(isPublicTheme('neon')).toBe(false);
        expect(isPublicTheme(null)).toBe(false);
    });

    it('параметр сильнее сохранённой темы, мусор игнорируется', () => {
        expect(resolveTheme('dark', 'palette-blue')).toBe('dark');
        expect(resolveTheme('neon', 'palette-blue')).toBe('palette-blue');
        expect(resolveTheme(null, 'palette-green')).toBe('palette-green');
        expect(resolveTheme(null, null)).toBe('light');
        expect(resolveTheme('bad', 'bad')).toBe('light');
    });

    it('тёмный режим только у dark', () => {
        expect(themeMode('dark')).toBe('dark');
        expect(themeMode('light')).toBe('light');
        expect(themeMode('palette-violet')).toBe('light');
    });

    it('палитра красит копии таблиц по кругу и не мутирует исходные', () => {
        const tables = Array.from({ length: 7 }, (_, i) => ({
            id: `t${i}`,
            color: '#000000',
        }));
        const painted = applyPalette(tables, 'palette-blue');
        expect(painted).not.toBe(tables);
        expect(tables.every((t) => t.color === '#000000')).toBe(true);
        expect(painted[0].color).not.toBe('#000000');
        expect(painted[0].color).toBe(painted[5].color);
        expect(painted[0].color).not.toBe(painted[1].color);
    });

    it('light и dark возвращают исходный массив', () => {
        const tables = [{ id: 't', color: '#123456' }];
        expect(applyPalette(tables, 'light')).toBe(tables);
        expect(applyPalette(tables, 'dark')).toBe(tables);
    });
});

describe('public-share: fetchPublicDiagram', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const stub = (status: number, body: unknown) =>
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: status >= 200 && status < 300,
                status,
                json: async () => body,
            })
        );

    it('200 -> diagram', async () => {
        stub(200, {
            id: 'a',
            title: 'T',
            content: {},
            database_type: 'postgresql',
            public_theme: 'dark',
            updated_at: '2026-01-01T00:00:00Z',
            grace_until: null,
        });
        const res = await fetchPublicDiagram('a');
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.diagram.title).toBe('T');
    });

    it('404 closed и not_found различаются', async () => {
        stub(404, { code: 'closed' });
        expect(await fetchPublicDiagram('a')).toEqual({
            ok: false,
            code: 'closed',
        });
        stub(404, { code: 'not_found' });
        expect(await fetchPublicDiagram('a')).toEqual({
            ok: false,
            code: 'not_found',
        });
    });

    it('сетевая ошибка -> error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
        expect(await fetchPublicDiagram('a')).toEqual({
            ok: false,
            code: 'error',
        });
    });
});
