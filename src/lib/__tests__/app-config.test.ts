import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
    vi.resetModules();
    return import('../app-config');
};

describe('app-config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('по умолчанию база /tools/erd2, индексация выключена', async () => {
        vi.stubEnv('VITE_APP_BASE', '');
        vi.stubEnv('VITE_ABOUT_INDEXABLE', '');
        const m = await load();
        expect(m.APP_BASE).toBe('/tools/erd2');
        expect(m.appUrl('/d/abc')).toBe('/tools/erd2/d/abc');
        expect(m.appUrl('')).toBe('/tools/erd2/');
        expect(m.ABOUT_INDEXABLE).toBe(false);
    });

    it('база из VITE_APP_BASE без завершающих слэшей', async () => {
        vi.stubEnv('VITE_APP_BASE', '/tools/erd/');
        const m = await load();
        expect(m.APP_BASE).toBe('/tools/erd');
        expect(m.appUrl('/d/abc')).toBe('/tools/erd/d/abc');
        expect(m.appUrl('')).toBe('/tools/erd/');
    });

    it('ABOUT_INDEXABLE включается только значением "true"', async () => {
        vi.stubEnv('VITE_ABOUT_INDEXABLE', 'true');
        expect((await load()).ABOUT_INDEXABLE).toBe(true);
        vi.stubEnv('VITE_ABOUT_INDEXABLE', 'yes');
        expect((await load()).ABOUT_INDEXABLE).toBe(false);
    });
});
