import { describe, expect, it } from 'vitest';
import { DatabaseType } from '../../../domain';
import { dataTypeMap } from '../data-types';
import {
    generateFieldRegexPatterns,
    getDefaultCharLength,
} from '../field-type-patterns';

const findType = (databaseType: DatabaseType, id: string) => {
    const type = dataTypeMap[databaseType].find((t) => t.id === id);
    if (!type) {
        throw new Error(`type ${id} not found for ${databaseType}`);
    }
    return type;
};

// Select-box applies the string pattern with the "i" flag, mirror it here.
const accepts = (regex: string | undefined, input: string) =>
    regex ? new RegExp(regex, 'i').test(input) : false;

describe('generateFieldRegexPatterns', () => {
    describe('types with a character length (postgres varchar)', () => {
        const { regex, extractRegex } = generateFieldRegexPatterns(
            findType(DatabaseType.POSTGRESQL, 'varchar'),
            DatabaseType.POSTGRESQL
        );

        it.each([
            'varchar(100)',
            'VARCHAR(100)',
            'Varchar(100)',
            'varchar (100)',
            'varchar( 100 )',
            'varchar  (  100  )',
        ])('accepts %s', (input) => {
            expect(accepts(regex, input)).toBe(true);
        });

        it.each([
            'varchar',
            'varchar(',
            'varchar()',
            'varchar(abc)',
            'varchar(10,2)',
            'varchar(100)x',
            'xvarchar(100)',
            'char(100)',
        ])('rejects %s', (input) => {
            expect(accepts(regex, input)).toBe(false);
        });

        it('extracts the length regardless of case and spaces', () => {
            expect('VARCHAR ( 100 )'.match(extractRegex!)?.[1]).toBe('100');
            expect('varchar(255)'.match(extractRegex!)?.[1]).toBe('255');
        });
    });

    describe('char does not match varchar input', () => {
        const { regex } = generateFieldRegexPatterns(
            findType(DatabaseType.POSTGRESQL, 'char'),
            DatabaseType.POSTGRESQL
        );

        it('accepts char(10) but not varchar(10)', () => {
            expect(accepts(regex, 'char(10)')).toBe(true);
            expect(accepts(regex, 'CHAR (10)')).toBe(true);
            expect(accepts(regex, 'varchar(10)')).toBe(false);
        });
    });

    describe('types with MAX option (sql server varchar)', () => {
        const { regex, extractRegex } = generateFieldRegexPatterns(
            findType(DatabaseType.SQL_SERVER, 'varchar'),
            DatabaseType.SQL_SERVER
        );

        it.each([
            'varchar(max)',
            'VARCHAR(MAX)',
            'varchar ( Max )',
            'varchar(50)',
        ])('accepts %s', (input) => {
            expect(accepts(regex, input)).toBe(true);
        });

        it('extracts max and numbers', () => {
            expect('varchar( MAX )'.match(extractRegex!)?.[1]).toBe('MAX');
            expect('varchar (50)'.match(extractRegex!)?.[1]).toBe('50');
        });
    });

    describe('precision and scale (postgres numeric)', () => {
        const { regex, extractRegex } = generateFieldRegexPatterns(
            findType(DatabaseType.POSTGRESQL, 'numeric'),
            DatabaseType.POSTGRESQL
        );

        it.each([
            'numeric(10)',
            'numeric(10,2)',
            'numeric(10, 2)',
            'NUMERIC ( 10 , 2 )',
        ])('accepts %s', (input) => {
            expect(accepts(regex, input)).toBe(true);
        });

        it('extracts precision and scale', () => {
            const m = 'NUMERIC ( 10 , 2 )'.match(extractRegex!);
            expect(m?.[1]).toBe('10');
            expect(m?.[2]).toBe('2');
        });

        it('rejects garbage', () => {
            expect(accepts(regex, 'numeric(10,)')).toBe(false);
            expect(accepts(regex, 'numeric(a)')).toBe(false);
        });
    });

    describe('arrays', () => {
        const { regex, extractRegex } = generateFieldRegexPatterns(
            findType(DatabaseType.POSTGRESQL, 'varchar'),
            DatabaseType.POSTGRESQL
        );

        it('keeps accepting the [] suffix for supporting databases', () => {
            expect(accepts(regex, 'varchar(10)[]')).toBe(true);
            expect('VARCHAR(10)[]'.match(extractRegex!)?.[2]).toBe('[]');
        });
    });

    describe('types without attributes', () => {
        it('keeps matching only the plain name', () => {
            const { regex } = generateFieldRegexPatterns(
                findType(DatabaseType.POSTGRESQL, 'boolean'),
                DatabaseType.POSTGRESQL
            );
            expect(accepts(regex, 'boolean')).toBe(true);
            expect(accepts(regex, 'boolean(5)')).toBe(false);
        });
    });
});

describe('getDefaultCharLength', () => {
    it('prefills 255 for varchar in common databases', () => {
        for (const db of [
            DatabaseType.POSTGRESQL,
            DatabaseType.MYSQL,
            DatabaseType.SQL_SERVER,
            DatabaseType.SQLITE,
        ]) {
            expect(getDefaultCharLength(findType(db, 'varchar'), db)).toBe(
                '255'
            );
        }
    });

    it('does not prefill char, text or non-length types', () => {
        expect(
            getDefaultCharLength(
                findType(DatabaseType.POSTGRESQL, 'char'),
                DatabaseType.POSTGRESQL
            )
        ).toBeUndefined();
        expect(
            getDefaultCharLength(
                findType(DatabaseType.POSTGRESQL, 'text'),
                DatabaseType.POSTGRESQL
            )
        ).toBeUndefined();
    });

    it('never prefills for ClickHouse', () => {
        expect(
            getDefaultCharLength(
                findType(DatabaseType.CLICKHOUSE, 'varchar'),
                DatabaseType.CLICKHOUSE
            )
        ).toBeUndefined();
    });
});
