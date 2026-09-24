import { describe, it, expect } from 'vitest';
import { exportFileName, transliterate } from '../file-name';

describe('transliterate', () => {
    it('converts Cyrillic to lowercase Latin', () => {
        expect(transliterate('Мой Магазин')).toBe('moy magazin');
        expect(transliterate('Щука Ёж')).toBe('schuka ezh');
    });
    it('keeps other characters', () => {
        expect(transliterate('Shop_DB 2')).toBe('shop_db 2');
    });
});

describe('exportFileName', () => {
    it('builds a safe file name with the extension', () => {
        expect(exportFileName('Мой Магазин', 'sql')).toBe('moy-magazin.sql');
        expect(exportFileName('Diagram 1', 'png')).toBe('diagram-1.png');
    });
    it('strips path-like and special characters', () => {
        expect(exportFileName('../a/b:c*?.', 'md')).toBe('a-b-c.md');
    });
    it('falls back to "schema" for empty results', () => {
        expect(exportFileName('', 'json')).toBe('schema.json');
        expect(exportFileName('???', 'json')).toBe('schema.json');
    });
});
