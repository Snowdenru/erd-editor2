import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import {
    SQL_TARGETS,
    generateSql,
    isSqlTargetAvailable,
    pickDefaultSqlTarget,
} from '../sql';
import { makeDiagram, makeField, makeTable, shopDiagram } from './fixtures';

const {
    GENERIC,
    POSTGRESQL,
    MYSQL,
    MARIADB,
    SQL_SERVER,
    SQLITE,
    ORACLE,
    COCKROACHDB,
    CLICKHOUSE,
} = DatabaseType;

describe('SQL_TARGETS', () => {
    it('lists all nine targets, Generic first', () => {
        expect(SQL_TARGETS).toEqual([
            GENERIC,
            POSTGRESQL,
            MYSQL,
            MARIADB,
            SQL_SERVER,
            SQLITE,
            ORACLE,
            COCKROACHDB,
            CLICKHOUSE,
        ]);
    });
});

describe('isSqlTargetAvailable', () => {
    it('always allows Generic', () => {
        for (const source of SQL_TARGETS) {
            expect(isSqlTargetAvailable(source, GENERIC)).toBe(true);
        }
    });

    it('allows the native dialects of the diagram itself', () => {
        for (const type of [POSTGRESQL, MYSQL, MARIADB, SQL_SERVER, SQLITE]) {
            expect(isSqlTargetAvailable(type, type)).toBe(true);
        }
    });

    it('does not pretend to speak dialects without a native exporter', () => {
        for (const type of [ORACLE, COCKROACHDB, CLICKHOUSE]) {
            expect(isSqlTargetAvailable(type, type)).toBe(false);
        }
    });

    it('allows only the deterministic PostgreSQL conversions', () => {
        expect(isSqlTargetAvailable(POSTGRESQL, MYSQL)).toBe(true);
        expect(isSqlTargetAvailable(POSTGRESQL, MARIADB)).toBe(true);
        expect(isSqlTargetAvailable(POSTGRESQL, SQL_SERVER)).toBe(true);
        expect(isSqlTargetAvailable(POSTGRESQL, SQLITE)).toBe(false);
        expect(isSqlTargetAvailable(POSTGRESQL, ORACLE)).toBe(false);
        expect(isSqlTargetAvailable(MYSQL, POSTGRESQL)).toBe(false);
    });
});

describe('pickDefaultSqlTarget', () => {
    it('uses the diagram dialect when it has a native exporter, else Generic', () => {
        expect(pickDefaultSqlTarget(POSTGRESQL)).toBe(POSTGRESQL);
        expect(pickDefaultSqlTarget(SQLITE)).toBe(SQLITE);
        expect(pickDefaultSqlTarget(ORACLE)).toBe(GENERIC);
        expect(pickDefaultSqlTarget(GENERIC)).toBe(GENERIC);
    });
});

describe('generateSql', () => {
    it('produces CREATE TABLE statements for the native dialect', () => {
        const sql = generateSql(shopDiagram(), POSTGRESQL);
        expect(sql).toContain('CREATE TABLE');
        expect(sql).toContain('users');
        expect(sql).toContain('orders');
    });

    it('produces a different script for a deterministic conversion', () => {
        const pg = generateSql(shopDiagram(), POSTGRESQL);
        const mysql = generateSql(shopDiagram(), MYSQL);
        expect(mysql).toContain('CREATE TABLE');
        expect(mysql).not.toBe(pg);
    });

    it('returns an empty string for a diagram without tables', () => {
        expect(generateSql(makeDiagram(), POSTGRESQL)).toBe('');
    });

    it('does not mutate the diagram it is given', () => {
        const diagram = makeDiagram({
            tables: [
                makeTable({
                    id: 'a',
                    name: 'a',
                    fields: [
                        makeField({
                            id: 'a-id',
                            name: 'id',
                            primaryKey: true,
                            type: { id: 'integer', name: 'integer' },
                        }),
                    ],
                }),
                makeTable({
                    id: 'b',
                    name: 'b',
                    fields: [
                        makeField({
                            id: 'b-a',
                            name: 'a_id',
                            type: { id: 'bigint', name: 'bigint' },
                        }),
                    ],
                }),
            ],
            relationships: [
                {
                    id: 'r',
                    name: 'fk',
                    sourceTableId: 'a',
                    targetTableId: 'b',
                    sourceFieldId: 'a-id',
                    targetFieldId: 'b-a',
                    sourceCardinality: 'one',
                    targetCardinality: 'many',
                    createdAt: 0,
                },
            ],
        });
        const before = JSON.stringify(diagram);
        generateSql(diagram, GENERIC);
        expect(JSON.stringify(diagram)).toBe(before);
    });
});
