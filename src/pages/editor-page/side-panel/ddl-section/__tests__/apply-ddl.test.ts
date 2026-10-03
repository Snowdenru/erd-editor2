import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { parseDdl, replaceDiagramContent } from '../apply-ddl';

const VALID_SQL = `
CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL);
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);
`;

describe('parseDdl', () => {
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

    it('возвращает error для синтаксически неверного SQL', async () => {
        const result = await parseDdl(
            'CREATE TABLE users (id SERIAL PRIMARY KEY,,, );',
            DatabaseType.POSTGRESQL
        );
        expect(result.status).toBe('error');
    });

    it('возвращает no-tables, если в SQL нет таблиц', async () => {
        const result = await parseDdl('SELECT 1;', DatabaseType.POSTGRESQL);
        expect(['no-tables', 'error']).toContain(result.status);
        expect(result.status).not.toBe('ok');
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
});
