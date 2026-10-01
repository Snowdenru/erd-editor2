import { describe, it, expect } from 'vitest';
import {
    NEW_DIAGRAM_PATH,
    DIAGRAMS_PATH,
    diagramPath,
    templateUsePath,
} from '../erd-paths';

describe('erd-paths', () => {
    it('строит целевые пути', () => {
        expect(NEW_DIAGRAM_PATH).toBe('/new');
        expect(DIAGRAMS_PATH).toBe('/diagrams');
        expect(diagramPath('abc')).toBe('/d/abc');
        expect(diagramPath('legacy-1b2c')).toBe('/d/legacy-1b2c');
        expect(templateUsePath('shop')).toBe('/templates/shop/use');
    });
});
