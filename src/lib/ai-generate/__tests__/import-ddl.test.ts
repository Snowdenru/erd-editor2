import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import { ddlToDiagram } from '../import-ddl';

const sqlImportToDiagram = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/sql-import', () => ({ sqlImportToDiagram }));

beforeEach(() => sqlImportToDiagram.mockReset());

describe('ddlToDiagram', () => {
    it('imports with the dialect as source and target and names the diagram after the prompt', async () => {
        sqlImportToDiagram.mockResolvedValue({
            id: 'd1',
            name: 'Diagram 1',
            databaseType: DatabaseType.MYSQL,
            tables: [{ id: 't1' }],
        });
        const diagram = await ddlToDiagram({
            ddl: 'CREATE TABLE a (id int);',
            dialect: 'mysql',
            prompt: 'Школа: ученики и классы',
        });
        expect(sqlImportToDiagram).toHaveBeenCalledWith({
            sqlContent: 'CREATE TABLE a (id int);',
            sourceDatabaseType: DatabaseType.MYSQL,
            targetDatabaseType: DatabaseType.MYSQL,
        });
        expect(diagram.id).toBe('d1');
        expect(diagram.name).toBe('Школа: ученики и классы');
        expect(diagram.createdAt).toBeInstanceOf(Date);
        expect(diagram.updatedAt).toBeInstanceOf(Date);
    });

    it('rejects a diagram without tables', async () => {
        sqlImportToDiagram.mockResolvedValue({
            id: 'd1',
            name: 'x',
            tables: [],
        });
        await expect(
            ddlToDiagram({
                ddl: 'SELECT 1;',
                dialect: 'postgresql',
                prompt: 'школа',
            })
        ).rejects.toThrow('no_tables');
    });

    it('propagates parser errors', async () => {
        sqlImportToDiagram.mockRejectedValueOnce(new Error('syntax'));
        await expect(
            ddlToDiagram({ ddl: '???', dialect: 'postgresql', prompt: 'школа' })
        ).rejects.toThrow('syntax');
    });

    it('rejects broken SQL with the stable sanity error before parsing', async () => {
        await expect(
            ddlToDiagram({
                ddl: 'CREATE TABLE a (id int,,);',
                dialect: 'postgresql',
                prompt: 'школа',
            })
        ).rejects.toThrow('sanity');
        expect(sqlImportToDiagram).not.toHaveBeenCalled();
    });

    it.each(['postgresql', 'mysql', 'mssql', 'sqlite'] as const)(
        'passes valid multi-table DDL through the guard (%s)',
        async (dialect) => {
            sqlImportToDiagram.mockResolvedValue({
                id: 'd1',
                name: 'x',
                tables: [{ id: 't1' }],
            });
            const ddl =
                'CREATE TABLE a (id int PRIMARY KEY, name varchar(50));\n' +
                'CREATE TABLE b (id int PRIMARY KEY, a_id int, FOREIGN KEY (a_id) REFERENCES a(id));';
            await ddlToDiagram({ ddl, dialect, prompt: 'школа' });
            expect(sqlImportToDiagram).toHaveBeenCalledTimes(1);
        }
    );
});
