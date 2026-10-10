import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import { AiApiError } from '../types';
import { toApiDialect, toDatabaseType, AI_DIALECT_OPTIONS } from '../dialect';
import { countCreateTables, pluralTables, titleFromPrompt } from '../format';
import { consumePending, savePending } from '../pending';
import { emitOpenAiGenerate, onOpenAiGenerate } from '../events';
import { AI_EXAMPLES } from '../examples';

describe('dialect mapping', () => {
    it('maps fork database types to API dialects', () => {
        expect(toApiDialect(DatabaseType.POSTGRESQL)).toBe('postgresql');
        expect(toApiDialect(DatabaseType.COCKROACHDB)).toBe('postgresql');
        expect(toApiDialect(DatabaseType.MYSQL)).toBe('mysql');
        expect(toApiDialect(DatabaseType.MARIADB)).toBe('mysql');
        expect(toApiDialect(DatabaseType.SQL_SERVER)).toBe('mssql');
        expect(toApiDialect(DatabaseType.SQLITE)).toBe('sqlite');
        expect(toApiDialect(DatabaseType.GENERIC)).toBe('postgresql');
        expect(toApiDialect(DatabaseType.ORACLE)).toBe('postgresql');
    });

    it('maps API dialects back to database types', () => {
        expect(toDatabaseType('postgresql')).toBe(DatabaseType.POSTGRESQL);
        expect(toDatabaseType('mysql')).toBe(DatabaseType.MYSQL);
        expect(toDatabaseType('mssql')).toBe(DatabaseType.SQL_SERVER);
        expect(toDatabaseType('sqlite')).toBe(DatabaseType.SQLITE);
    });

    it('offers the four dialects the backend supports', () => {
        expect(AI_DIALECT_OPTIONS.map((o) => o.value)).toEqual([
            'postgresql',
            'mysql',
            'mssql',
            'sqlite',
        ]);
    });
});

describe('format helpers', () => {
    it('counts CREATE TABLE statements case-insensitively', () => {
        expect(countCreateTables('')).toBe(0);
        expect(
            countCreateTables(
                'CREATE TABLE a (id int);\ncreate  table b (id int);\nCREATE INDEX i ON a(id);'
            )
        ).toBe(2);
    });

    it('builds a short title from the first line of the prompt', () => {
        expect(
            titleFromPrompt('Интернет-магазин: товары и заказы\nещё строка')
        ).toBe('Интернет-магазин: товары и заказы');
        expect(titleFromPrompt('x'.repeat(100))).toHaveLength(40);
        expect(titleFromPrompt('   ')).toBe('Схема от ИИ');
    });

    it('pluralizes tables in Russian', () => {
        expect(pluralTables(1)).toBe('1 таблица');
        expect(pluralTables(2)).toBe('2 таблицы');
        expect(pluralTables(5)).toBe('5 таблиц');
        expect(pluralTables(11)).toBe('11 таблиц');
        expect(pluralTables(21)).toBe('21 таблица');
        expect(pluralTables(0)).toBe('0 таблиц');
    });
});

describe('pending prompt', () => {
    beforeEach(() => {
        localStorage.clear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, pathname: '/tools/erd/' },
        });
    });

    it('returns the saved prompt once and then clears it', () => {
        savePending({ prompt: 'школа', dialect: 'mysql' }, 1000);
        expect(consumePending(1000 + 60_000)).toMatchObject({
            prompt: 'школа',
            dialect: 'mysql',
        });
        expect(consumePending(1000 + 60_000)).toBeNull();
    });

    it('drops an expired prompt (30 minutes)', () => {
        savePending({ prompt: 'школа', dialect: 'mysql' }, 1000);
        expect(consumePending(1000 + 31 * 60_000)).toBeNull();
        expect(localStorage.getItem('erd2_ai_pending')).toBeNull();
    });

    it('does not resume on a different page but keeps the prompt', () => {
        savePending({ prompt: 'школа', dialect: 'mysql' }, 1000);
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, pathname: '/tools/erd/d/abc' },
        });
        expect(consumePending(2000)).toBeNull();
        expect(localStorage.getItem('erd2_ai_pending')).not.toBeNull();
    });

    it('survives unavailable localStorage', () => {
        const original = Object.getOwnPropertyDescriptor(
            window,
            'localStorage'
        );
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: () => {
                    throw new Error('denied');
                },
                setItem: () => {
                    throw new Error('denied');
                },
                removeItem: () => undefined,
            },
        });
        try {
            expect(() =>
                savePending({ prompt: 'школа', dialect: 'mysql' })
            ).not.toThrow();
            expect(consumePending()).toBeNull();
        } finally {
            if (original)
                Object.defineProperty(window, 'localStorage', original);
        }
    });
});

describe('open events', () => {
    it('delivers the detail to subscribers and supports unsubscribe', () => {
        const handler = vi.fn();
        const off = onOpenAiGenerate(handler);
        emitOpenAiGenerate({
            source: 'landing',
            prompt: 'школа',
            autostart: true,
        });
        expect(handler).toHaveBeenCalledWith({
            source: 'landing',
            prompt: 'школа',
            autostart: true,
        });
        off();
        emitOpenAiGenerate({ source: 'landing' });
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('examples and errors', () => {
    it('has five chips with non-empty prompts', () => {
        expect(AI_EXAMPLES).toHaveLength(5);
        AI_EXAMPLES.forEach((e) => {
            expect(e.label.length).toBeGreaterThan(0);
            expect(e.prompt.length).toBeGreaterThan(20);
        });
    });

    it('AiApiError keeps status, code and limit', () => {
        const e = new AiApiError(403, 'generation_limit', 3);
        expect([e.status, e.code, e.limit]).toEqual([
            403,
            'generation_limit',
            3,
        ]);
        expect(e).toBeInstanceOf(Error);
    });
});
