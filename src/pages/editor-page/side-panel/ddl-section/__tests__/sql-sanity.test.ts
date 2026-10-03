import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import { findSqlSanityProblem } from '../sql-sanity';

const PG = DatabaseType.POSTGRESQL;
const MY = DatabaseType.MYSQL;
const MS = DatabaseType.SQL_SERVER;
const ORA = DatabaseType.ORACLE;

describe('findSqlSanityProblem: однозначные ошибки', () => {
    it('unbalanced-close с номером строки', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t (a INT);\n);\n', PG)
        ).toEqual({ code: 'unbalanced-close', line: 2 });
    });

    it('unclosed-paren: строка самой ранней незакрытой скобки', () => {
        expect(
            findSqlSanityProblem(
                'CREATE TABLE t (\n  a INT,\n  b NUMERIC(10,2\n);\n',
                PG
            )
        ).toEqual({ code: 'unclosed-paren', line: 1 });
    });

    it('double-comma: строка второй запятой', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t (\n a INT,\n, b INT\n);', PG)
        ).toEqual({ code: 'double-comma', line: 3 });
        expect(
            findSqlSanityProblem('CREATE TABLE t (id INT,,, name TEXT;', PG)
        ).toEqual({ code: 'double-comma', line: 1 });
    });

    it('comma-before-close: строка запятой', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t (\n a INT,\n b INT,\n);', PG)
        ).toEqual({ code: 'comma-before-close', line: 3 });
    });

    it('запятые через комментарии тоже находятся', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t (a INT, /* x */ , b INT);', PG)
        ).toEqual({ code: 'double-comma', line: 1 });
        expect(
            findSqlSanityProblem('CREATE TABLE t (a INT, -- c\n);', PG)
        ).toEqual({ code: 'comma-before-close', line: 1 });
    });
});

describe('findSqlSanityProblem: валидный SQL не помечается', () => {
    const ok = (sql: string, db: DatabaseType = PG) =>
        expect(findSqlSanityProblem(sql, db)).toBeNull();

    it('простые и многострочные CREATE TABLE', () => {
        ok('CREATE TABLE t (a INT, b INT)');
        ok('CREATE TABLE t (\n a INT,\n b INT\n);\nCREATE TABLE u (id INT);');
        ok('CREATE TABLE t (a NUMERIC(10,2), b VARCHAR(5) DEFAULT (1+2));');
        ok('');
    });

    it('запятые и скобки внутри строк', () => {
        ok("CREATE TABLE t (a TEXT DEFAULT ',,', b INT);");
        ok("CREATE TABLE t (a TEXT DEFAULT ')', b TEXT DEFAULT '(');");
        ok("CREATE TABLE t (a TEXT DEFAULT 'it''s ,,)');");
    });

    it('скобки и запятые в комментариях', () => {
        ok('CREATE TABLE t (a INT, -- коммент, с запятой ,, )\n b INT);');
        ok('CREATE TABLE t (a INT, /* ) ,, ( */ b INT);');
        ok("-- it's ( broken\nCREATE TABLE t (a INT);");
    });

    it('идентификаторы в кавычках', () => {
        ok('CREATE TABLE t ("a)b" INT, "c,,d" INT, "q""(" INT);');
        ok('CREATE TABLE `t)` (`a,,b` INT);', MY);
        ok('CREATE TABLE t ([a)b] INT, [c,,d] INT);', MS);
    });

    it("PostgreSQL: E'...' с экранированием, '...\\' без экранирования", () => {
        ok("CREATE TABLE t (a TEXT DEFAULT E'it\\'s ,,');");
        ok("CREATE TABLE t (a TEXT DEFAULT 'C:\\', b INT);");
        ok("CREATE TABLE t (a TEXT DEFAULT 'C:\\', b TEXT DEFAULT ')');");
    });

    it("MySQL: 'it\\'s' и обратный слэш", () => {
        ok("CREATE TABLE t (a TEXT DEFAULT 'it\\'s', b INT);", MY);
        ok("CREATE TABLE t (a TEXT DEFAULT 'it\\'s ,,)', b INT);", MY);
        // NO_BACKSLASH_ESCAPES-совместимая строка
        ok("CREATE TABLE t (a TEXT DEFAULT 'C:\\', b INT);", MY);
    });

    it('MySQL: # и -- комментарии', () => {
        ok('# ) ,, (\nCREATE TABLE t (a INT);', MY);
        ok('CREATE TABLE t (a INT, -- ) ,,\n b INT);', MY);
    });

    it('долларовые тела функций PostgreSQL', () => {
        ok(
            'CREATE FUNCTION f() RETURNS int AS $$ SELECT (1,,2 $$ LANGUAGE sql;'
        );
        ok(
            'CREATE FUNCTION f() RETURNS int AS $body$ BEGIN RETURN (1,,2; END $body$ LANGUAGE plpgsql;'
        );
        ok('SELECT $1, $2;');
    });

    it('вложенные блочные комментарии PostgreSQL', () => {
        ok('/* a /* ) ,, */ ( */ CREATE TABLE t (a INT);');
    });

    it('Oracle q-строки и тела блоков', () => {
        ok("SELECT q'[it's ) ,,]' FROM dual;", ORA);
        ok("SELECT q'(a ) b)' FROM dual;", ORA);
        ok("SELECT q'!x ( ,, !' FROM dual;", ORA);
        ok(
            "BEGIN\n  EXECUTE IMMEDIATE 'CREATE TABLE t (a INT)';\nEND;\n/",
            ORA
        );
    });

    it('MySQL/PG BEGIN ... END тела', () => {
        ok(
            'CREATE FUNCTION f() RETURNS INT BEGIN DECLARE x INT; SET x = (1 + 2); RETURN x; END;',
            MY
        );
    });

    it('незакрытая строка/комментарий/идентификатор → null', () => {
        ok("CREATE TABLE t (a TEXT DEFAULT 'abc,,");
        ok('CREATE TABLE t (a INT, /* ,, ) ');
        ok('CREATE TABLE t ("a ,, ) ');
        ok('CREATE TABLE t (a INT,,) $$ unterminated');
        ok("CREATE TABLE t (a INT,,) ) 'oops");
        ok("SELECT q'[abc", ORA);
        ok('CREATE TABLE t ([a ,,', MS);
    });
});
