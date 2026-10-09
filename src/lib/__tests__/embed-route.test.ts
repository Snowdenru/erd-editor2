import { describe, expect, it } from 'vitest';
import { isEmbedPath } from '../embed-route';

describe('isEmbedPath', () => {
    it('узнаёт embed под базой приложения, со слэшем и без', () => {
        expect(isEmbedPath('/tools/erd/v/abc/embed')).toBe(true);
        expect(isEmbedPath('/tools/erd/v/abc/embed/')).toBe(true);
        expect(isEmbedPath('/tools/erd2/v/a-b_1/embed')).toBe(true);
    });

    it('обычные страницы — не embed', () => {
        expect(isEmbedPath('/tools/erd/v/abc')).toBe(false);
        expect(isEmbedPath('/tools/erd/')).toBe(false);
        expect(isEmbedPath('/tools/erd/d/embed')).toBe(false);
        expect(isEmbedPath('/tools/erd/v/abc/embed/x')).toBe(false);
        expect(isEmbedPath('/tools/erd/v//embed')).toBe(false);
    });
});
