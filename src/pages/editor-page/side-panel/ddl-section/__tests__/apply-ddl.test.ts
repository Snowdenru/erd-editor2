import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { Area } from '@/lib/domain/area';
import type { Note } from '@/lib/domain/note';
import { MAX_TABLES_IN_DIAGRAM } from '@/dialogs/common/select-tables/constants';
import { DatabaseEdition } from '@/lib/domain/database-edition';
import { DBCustomTypeKind } from '@/lib/domain/db-custom-type';
import { MAX_DDL_CHARS, parseDdl, replaceDiagramContent } from '../apply-ddl';

const parseSqlErrorOverride = vi.hoisted(() => ({
    value: undefined as undefined | { success: boolean; error?: string },
}));
vi.mock('@/lib/data/sql-import', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const original = actual.parseSQLError as (
        ...args: unknown[]
    ) => Promise<unknown>;
    return {
        ...actual,
        parseSQLError: (...args: unknown[]) =>
            parseSqlErrorOverride.value
                ? Promise.resolve(parseSqlErrorOverride.value)
                : original(...args),
    };
});

const VALID_SQL = `
CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL);
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);
`;

describe('parseDdl', () => {
    beforeEach(() => {
        parseSqlErrorOverride.value = undefined;
    });

    it('возвращает too-many-tables, если таблиц больше лимита', async () => {
        const sql = Array.from(
            { length: MAX_TABLES_IN_DIAGRAM + 1 },
            (_, i) => `CREATE TABLE t${i} (id INT PRIMARY KEY);`
        ).join('\n');
        const result = await parseDdl(sql, DatabaseType.POSTGRESQL);
        expect(result.status).toBe('too-many-tables');
        if (result.status !== 'too-many-tables') return;
        expect(result.count).toBe(MAX_TABLES_IN_DIAGRAM + 1);
        expect(result.limit).toBe(MAX_TABLES_IN_DIAGRAM);
    });

    it('возвращает empty для пустой строки', async () => {
        const result = await parseDdl('   \n ', DatabaseType.POSTGRESQL);
        expect(result.status).toBe('empty');
    });

    it('парсит валидный SQL в диаграмму с таблицами и связью', async () => {
        const result = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.diagram.tables?.map((t) => t.name).sort()).toEqual([
            'orders',
            'users',
        ]);
        expect(result.diagram.relationships).toHaveLength(1);
        expect(result.validation.tableCount).toBe(2);
        expect(result.validation.relationshipCount).toBe(1);
    });

    it('возвращает no-tables, если в SQL нет таблиц', async () => {
        const result = await parseDdl(
            'CREATE TABL users (id INT);',
            DatabaseType.POSTGRESQL
        );
        expect(result.status).toBe('no-tables');
    });

    it('возвращает error, если парсер отверг SQL', async () => {
        parseSqlErrorOverride.value = {
            success: false,
            error: 'boom at line 1',
        };
        const result = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        expect(result.status).toBe('error');
        if (result.status !== 'error') return;
        expect(result.message).toBe('boom at line 1');
    });

    it('возвращает syntax для двойных запятых (раньше было ok)', async () => {
        const result = await parseDdl(
            'CREATE TABLE users (id SERIAL PRIMARY KEY,,, );',
            DatabaseType.POSTGRESQL
        );
        expect(result.status).toBe('syntax');
        if (result.status !== 'syntax') return;
        expect(result.code).toBe('double-comma');
        expect(result.line).toBe(1);
        expect(result.validation.errors[0].line).toBe(1);
    });

    it('SQL Server: фикстура с «,)» (как в тестах импорта) не даёт syntax', async () => {
        const sql = `CREATE TABLE [DBO].[SpellDefinition](
  [SPELLID]  (VARCHAR)(32),    
  [HASVERBALCOMP] BOOLEAN,  
  [INCANTATION] [VARCHAR](128),  
  [INCANTATIONFIX] BOOLEAN,  
  [ITSCOMPONENTREL]  [VARCHAR](32), FOREIGN KEY (itscomponentrel) REFERENCES SpellComponent(SPELLID), 
  [SHOWVISUALS] BOOLEAN,    ) ON [PRIMARY]`;
        const result = await parseDdl(sql, DatabaseType.SQL_SERVER);
        expect(result.status).not.toBe('syntax');
    });

    it('возвращает too-large сразу, не запуская парсер', async () => {
        const sql = 'x'.repeat(MAX_DDL_CHARS + 1);
        const result = await parseDdl(sql, DatabaseType.POSTGRESQL);
        expect(result).toEqual({
            status: 'too-large',
            length: MAX_DDL_CHARS + 1,
            limit: MAX_DDL_CHARS,
        });
    });

    it('парсит валидный SQL со строками, содержащими запятые', async () => {
        const result = await parseDdl(
            "CREATE TABLE config (id SERIAL PRIMARY KEY, note TEXT DEFAULT ',,');",
            DatabaseType.POSTGRESQL
        );
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.diagram.tables).toHaveLength(1);
        expect(result.diagram.tables?.[0].name).toBe('config');
    });
});

describe('replaceDiagramContent', () => {
    it('сохраняет id/имя/тип БД и подменяет таблицы и связи', async () => {
        const parsedResult = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        if (parsedResult.status !== 'ok') throw new Error('parse failed');

        const current: Diagram = {
            id: 'diagram-1',
            name: 'Моя схема',
            databaseType: DatabaseType.POSTGRESQL,
            tables: [],
            relationships: [],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        };

        const next = replaceDiagramContent(current, parsedResult.diagram);

        expect(next.id).toBe('diagram-1');
        expect(next.name).toBe('Моя схема');
        expect(next.databaseType).toBe(DatabaseType.POSTGRESQL);
        expect(next.createdAt).toEqual(current.createdAt);
        expect(next.tables).toHaveLength(2);
        expect(next.relationships).toHaveLength(1);
        expect(next.updatedAt.getTime()).toBeGreaterThan(
            current.updatedAt.getTime()
        );
    });

    it('сохраняет области и заметки от текущей диаграммы', async () => {
        const parsedResult = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        if (parsedResult.status !== 'ok') throw new Error('parse failed');

        const area: Area = {
            id: 'area-1',
            name: 'User Module',
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            color: '#ff0000',
        };

        const note: Note = {
            id: 'note-1',
            content: 'Important note',
            x: 50,
            y: 100,
            width: 200,
            height: 100,
            color: '#ffff00',
        };

        const current: Diagram = {
            id: 'diagram-1',
            name: 'Схема с областями',
            databaseType: DatabaseType.POSTGRESQL,
            tables: [],
            relationships: [],
            areas: [area],
            notes: [note],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        };

        const next = replaceDiagramContent(current, parsedResult.diagram);

        expect(next.areas).toEqual([area]);
        expect(next.notes).toEqual([note]);
        expect(next.tables).toHaveLength(2);
        expect(next.relationships).toHaveLength(1);
    });

    it('заменяет dependencies и customTypes, сохраняет databaseEdition', () => {
        const current: Diagram = {
            id: 'd',
            name: 'n',
            databaseType: DatabaseType.POSTGRESQL,
            databaseEdition: DatabaseEdition.POSTGRESQL_SUPABASE,
            tables: [],
            relationships: [],
            dependencies: [
                {
                    id: 'old-dep',
                    tableId: 'a',
                    dependentTableId: 'b',
                    createdAt: 0,
                },
            ],
            customTypes: [],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        };
        const parsed: Diagram = {
            ...current,
            databaseEdition: undefined,
            dependencies: [
                {
                    id: 'new-dep',
                    tableId: 'c',
                    dependentTableId: 'd',
                    createdAt: 1,
                },
            ],
            customTypes: [
                {
                    id: 'ct',
                    name: 'mood',
                    kind: DBCustomTypeKind.enum,
                    values: ['a'],
                },
            ],
        };
        const next = replaceDiagramContent(current, parsed);
        expect(next.dependencies?.map((x) => x.id)).toEqual(['new-dep']);
        expect(next.customTypes?.map((x) => x.name)).toEqual(['mood']);
        expect(next.databaseEdition).toBe(DatabaseEdition.POSTGRESQL_SUPABASE);
    });
});
