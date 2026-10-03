import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import { findSqlSanityProblem, type SqlSanityProblem } from '../sql-sanity';

const PG = DatabaseType.POSTGRESQL;
const MY = DatabaseType.MYSQL;
const MS = DatabaseType.SQL_SERVER;
const ORA = DatabaseType.ORACLE;
const MA = DatabaseType.MARIADB;
const LT = DatabaseType.SQLITE;
const CH = DatabaseType.CLICKHOUSE;
const CR = DatabaseType.COCKROACHDB;
const GN = DatabaseType.GENERIC;
const ALL = [PG, MY, MA, MS, LT, ORA, CH, CR, GN];
const OR = ORA;

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

// Таблица ложных срабатываний, составленная независимым ревью
const VALID_CASES: [string, string, DatabaseType[]][] = [
    [
        'pg E string',
        `CREATE TABLE t (a TEXT DEFAULT E'it\\'s ,, ) (');`,
        [PG, CR],
    ],
    [
        'pg std backslash',
        `CREATE TABLE t (a TEXT DEFAULT 'C:\\', b INT);`,
        [PG, CR, MS, LT, OR, GN],
    ],
    [
        'pg $$ fn',
        `CREATE FUNCTION f() RETURNS trigger AS $$\nBEGIN\n  PERFORM (1,,2;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;`,
        [PG, CR],
    ],
    [
        'pg $tag$',
        `CREATE FUNCTION f() RETURNS int AS $body$ SELECT ( $$ ) $body$ LANGUAGE sql;`,
        [PG],
    ],
    ['pg $_$', `DO $_$ BEGIN RAISE NOTICE '(('; END $_$;`, [PG]],
    [
        'pg nested comment',
        `/* outer /* inner ) */ still ( */ CREATE TABLE t (a INT);`,
        [PG, CR],
    ],
    [
        'pg array',
        `CREATE TABLE t (a INT[] DEFAULT '{1,,2}', b INT[] DEFAULT ARRAY[1,2], c TEXT[][]);`,
        ALL,
    ],
    [
        'pg trigger',
        `CREATE TRIGGER trg BEFORE UPDATE ON t FOR EACH ROW EXECUTE FUNCTION f();`,
        ALL,
    ],
    [
        'pg $1 params',
        `CREATE FUNCTION f(int, int) RETURNS int AS 'SELECT $1 + $2' LANGUAGE sql;`,
        [PG],
    ],
    ['pg ident with $', `CREATE TABLE a$b (x$ INT, y INT);`, [PG]],
    [
        'pg U& string',
        `CREATE TABLE t (a TEXT DEFAULT U&'d\\0061t\\+000061');`,
        [PG],
    ],
    [
        'pg cast ::',
        `CREATE TABLE t (a NUMERIC(10,2) DEFAULT 0::numeric(10,2));`,
        ALL,
    ],
    [
        'pg check',
        `CREATE TABLE t (a INT CHECK (a > 0 AND (a < 10)), CONSTRAINT c UNIQUE (a));`,
        ALL,
    ],
    ['pg comment on', `COMMENT ON COLUMN t.a IS 'it''s a ) value, ,';`, ALL],
    [
        'pg partition',
        `CREATE TABLE m (d DATE) PARTITION BY RANGE (d);\nCREATE TABLE m1 PARTITION OF m FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');`,
        ALL,
    ],
    [
        'mysql backticks',
        'CREATE TABLE `t,)` (`a)` INT, `b,,` INT, KEY k (`a)`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
        [MY, MA, LT, CH, GN, PG, OR, MS],
    ],
    [
        'mysql backslash',
        `CREATE TABLE t (a VARCHAR(10) DEFAULT 'it\\'s ) ,,', b INT) ENGINE=InnoDB;`,
        [MY, MA],
    ],
    [
        'mysql backslash dq',
        `CREATE TABLE t (a VARCHAR(10) DEFAULT "say \\"hi\\" )", b INT);`,
        [MY, MA],
    ],
    [
        'mysql hash',
        `# it's a ) comment, ,\nCREATE TABLE t (a INT, KEY k (a)) ENGINE=MyISAM;`,
        [MY, MA],
    ],
    [
        'mysql -- with space',
        `CREATE TABLE t (a INT, -- it's ) ,\n b INT);`,
        ALL,
    ],
    ['mysql --tab', `CREATE TABLE t (a INT, --\tit's\n b INT);`, ALL],
    ['mysql --EOL', `CREATE TABLE t (a INT, --\n b INT);`, ALL],
    ['mysql --CRLF', `CREATE TABLE t (a INT, --\r\n b INT);`, ALL],
    [
        'mysql enum',
        "CREATE TABLE t (s ENUM('a,','b)','c''d') NOT NULL, PRIMARY KEY (s));",
        ALL,
    ],
    [
        'mysql versioned',
        '/*!40101 SET @OLD=@@X */;\nCREATE TABLE t (a INT) /*!50100 PARTITION BY RANGE (a) (PARTITION p0 VALUES LESS THAN (10)) */;',
        ALL,
    ],
    [
        'mysql delimiter',
        'DELIMITER $$\nCREATE PROCEDURE p(IN x INT)\nBEGIN\n  SELECT (x);\nEND$$\nDELIMITER ;',
        [MY, MA],
    ],
    [
        'mysql delimiter //',
        'DELIMITER //\nCREATE TRIGGER tr BEFORE INSERT ON t FOR EACH ROW BEGIN SET NEW.a = (1); END //\nDELIMITER ;',
        [MY, MA],
    ],
    [
        'mysql dump',
        "-- MySQL dump 10.13  Distrib 8.0.33\n/*!40101 SET NAMES utf8 */;\nDROP TABLE IF EXISTS `users`;\nCREATE TABLE `users` (\n  `id` int NOT NULL AUTO_INCREMENT,\n  `name` varchar(255) COMMENT 'user''s (name)',\n  PRIMARY KEY (`id`),\n  KEY `idx` (`name`(10))\n) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;\nINSERT INTO `users` VALUES (1,'O\\'Brien (x)'),(2,'a\\\\');",
        [MY, MA],
    ],
    [
        'mysql trailing backslash-quote',
        "INSERT INTO t VALUES ('a\\\\', ')');",
        [MY, MA],
    ],
    [
        'mssql brackets',
        `CREATE TABLE [dbo].[t),] ([a,,b] INT, [c]]d)] INT);\nGO\nCREATE INDEX [ix] ON [dbo].[t),]([a,,b]);\nGO`,
        [MS],
    ],
    [
        'mssql proc',
        `CREATE PROCEDURE dbo.p @x INT AS\nBEGIN\n  SET NOCOUNT ON;\n  IF (@x > 0) BEGIN SELECT N'it''s )'; END\nEND\nGO`,
        [MS],
    ],
    [
        'mssql N string',
        `CREATE TABLE t (a NVARCHAR(MAX) DEFAULT N'((', b INT);`,
        ALL,
    ],
    [
        'sqlite quoting',
        'CREATE TABLE "x)" ("a,," INTEGER, `b)` TEXT, c TEXT DEFAULT \'(\');',
        [LT, PG, OR, MS, GN, CH],
    ],
    [
        'sqlite brackets plain',
        'CREATE TABLE [t] ([a] INTEGER PRIMARY KEY, [b c] TEXT);',
        [LT, MS],
    ],
    [
        'oracle q quote',
        `INSERT INTO t VALUES (q'[it's ) ,, (]', Q'{x)}', q'!a(!');`,
        [OR],
    ],
    [
        'oracle plsql',
        `CREATE OR REPLACE PROCEDURE p(x IN NUMBER) IS\nBEGIN\n  IF (x > 0) THEN\n    DBMS_OUTPUT.PUT_LINE('it''s )');\n  END IF;\nEND;\n/`,
        [OR],
    ],
    [
        'oracle table',
        `CREATE TABLE t (id NUMBER(10,0) GENERATED BY DEFAULT AS IDENTITY, n VARCHAR2(20 CHAR), CONSTRAINT pk PRIMARY KEY (id)) TABLESPACE users;`,
        ALL,
    ],
    ['quoted ident with dq', `CREATE TABLE "a""b)" ("c,," INT);`, ALL],
    [
        'apostrophe in -- comment',
        `-- don't do this (\nCREATE TABLE t (a INT);`,
        ALL,
    ],
    [
        'apostrophe in block comment',
        `/* don't ( */ CREATE TABLE t (a INT);`,
        ALL,
    ],
    ['-- inside string', `CREATE TABLE t (a TEXT DEFAULT '-- (', b INT);`, ALL],
    [
        '/* inside string',
        `CREATE TABLE t (a TEXT DEFAULT '/* (', b INT); /* ) */`,
        ALL,
    ],
    [') in ident', `CREATE TABLE "a)b" (x INT);`, ALL],
    [
        'comma in comment before )',
        `CREATE TABLE t (a INT, b INT -- коммент, с запятой\n);`,
        ALL,
    ],
    ['CRLF', `CREATE TABLE t (\r\n  a INT,\r\n  b INT\r\n);\r\n`, ALL],
    [
        'unicode ident',
        `CREATE TABLE пользователи (имя TEXT, 名前 TEXT, "ü)" INT);`,
        ALL,
    ],
    [
        'empty parens',
        `CREATE TABLE t (a TIMESTAMP DEFAULT now(), b INT DEFAULT f( ));`,
        ALL,
    ],
    [
        'unterminated string -> null',
        `CREATE TABLE t (a TEXT DEFAULT 'abc, b INT,);`,
        ALL,
    ],
    ['unterminated comment -> null', `CREATE TABLE t (a INT, /* b INT,);`, ALL],
    [
        'clickhouse',
        `CREATE TABLE t (a UInt32, b String DEFAULT 'x', c Array(Tuple(UInt8, String))) ENGINE = MergeTree ORDER BY (a, b) SETTINGS index_granularity = 8192;`,
        ALL,
    ],
    // Potential known-risk inputs:
    [
        'MSSQL nested comment',
        `/*\nCREATE TABLE old (\n  id INT /* pk */,\n  name TEXT\n)\n*/\nCREATE TABLE t (a INT);`,
        [MS],
    ],
    [
        'MSSQL trailing comma (accepted by SQL Server)',
        `CREATE TABLE t (a INT, b INT,);`,
        [MS],
    ],
    [
        'ClickHouse backslash escape',
        `CREATE TABLE t (a String COMMENT 'don\\'t use ) here, it\\'s bad') ENGINE = MergeTree ORDER BY a;`,
        [CH],
    ],
    ['SQLite bracket with )', `CREATE TABLE t ([weird)] INT, b INT);`, [LT]],
    ['Oracle nq quote', `INSERT INTO t VALUES (nq'[it's) and it's]');`, [OR]],
    [
        'Oracle SQL*Plus PROMPT',
        `PROMPT Step 1) create tables\nCREATE TABLE t (a NUMBER);`,
        [OR],
    ],
    [
        'PG COPY data',
        `COPY public.t (a, b) FROM stdin;\n1\tfoo,,bar\n2\tsmile :)\n\\.\n`,
        [PG],
    ],
    ['PG psql meta', `\\set ON_ERROR_STOP on\nCREATE TABLE t (a INT);`, [PG]],
    [
        'Generic $$',
        `CREATE FUNCTION f() RETURNS int AS $$ SELECT ( $$ LANGUAGE sql;`,
        [GN],
    ],
    ['MySQL nested-like comment', `/* a /* b */ CREATE TABLE t (a INT);`, [MY]],
    [
        'PG E with escaped backslash end',
        `CREATE TABLE t (a TEXT DEFAULT E'\\\\', b TEXT DEFAULT ')');`,
        [PG],
    ],
    [
        'PG E-string lower',
        `CREATE TABLE t (a TEXT DEFAULT e'\\')', b INT);`,
        [PG],
    ],
    [
        'PG dollar tag-like in ident',
        `CREATE TABLE t (a INT DEFAULT 1);\nSELECT 1 AS "$x$(";`,
        [PG],
    ],
    [
        'MSSQL [ inside string',
        `CREATE TABLE t (a VARCHAR(10) DEFAULT '[', b INT DEFAULT ']');`,
        [MS],
    ],
    [
        'PG ARRAY slice',
        `CREATE TABLE t (a INT GENERATED ALWAYS AS ((arr)[1]) STORED);`,
        [PG],
    ],
    [
        'MySQL -- immediately followed by text is not comment',
        `CREATE TABLE t (a INT DEFAULT (5--1), b INT);`,
        [MY],
    ],
    ['CR only', 'CREATE TABLE t (\r a INT,\r b INT\r);', ALL],
    [
        'Oracle q-quote with quote delimiter <>',
        `SELECT q'<a ) b>' FROM dual;`,
        [OR],
    ],
    [
        'MSSQL QUOTED_IDENTIFIER string',
        `SET QUOTED_IDENTIFIER OFF; SELECT "it's )";`,
        [MS],
    ],
    [
        'mysql dq with backslash then quote in NO_BACKSLASH mode',
        `INSERT INTO t VALUES ('a\\', ')');`,
        [MY],
    ],
];

const TRUE_POSITIVES: [
    string,
    string,
    DatabaseType,
    SqlSanityProblem['code'],
    number,
][] = [
    ['double', 'CREATE TABLE t (\n a INT,\n\n ,b INT);', PG, 'double-comma', 4],
    ['double same', 'CREATE TABLE t (a INT,, b INT);', MY, 'double-comma', 1],
    [
        'comma-close',
        'CREATE TABLE t (\n a INT,\n -- c\n);',
        PG,
        'comma-before-close',
        2,
    ],
    ['unbalanced', 'CREATE TABLE t (a INT);\n\n);', LT, 'unbalanced-close', 3],
    [
        'unclosed',
        'CREATE TABLE a (x INT);\nCREATE TABLE t (\n a INT,\n b INT;\n',
        OR,
        'unclosed-paren',
        2,
    ],
    [
        'unclosed nested earliest',
        'CREATE TABLE t (\n a NUMERIC(10,\n',
        PG,
        'unclosed-paren',
        1,
    ],
    [
        'brief case',
        'CREATE TABLE users (id SERIAL PRIMARY KEY,,, );',
        PG,
        'double-comma',
        1,
    ],
    [
        'mysql both agree',
        "CREATE TABLE t (a INT DEFAULT 'x',\n);",
        MY,
        'comma-before-close',
        1,
    ],
];

describe('findSqlSanityProblem: таблица валидного SQL', () => {
    const rows = VALID_CASES.flatMap(([name, sql, dbs]) =>
        dbs.map((db) => [name, db, sql] as const)
    );
    it.each(rows)('%s [%s] не помечается', (_name, db, sql) => {
        expect(findSqlSanityProblem(sql, db)).toBeNull();
    });
});

describe('findSqlSanityProblem: таблица истинных ошибок', () => {
    it.each(TRUE_POSITIVES)('%s', (_n, sql, db, code, line) => {
        expect(findSqlSanityProblem(sql, db)).toEqual({ code, line });
    });
});

describe('findSqlSanityProblem: диалектные особенности', () => {
    it('SQL Server: «,)» допустима, «,,» нет', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t (a INT, b INT,);', MS)
        ).toBeNull();
        expect(
            findSqlSanityProblem('CREATE TABLE t (a INT,, b INT);', MS)
        ).toEqual({ code: 'double-comma', line: 1 });
    });

    it('SQL Server: блочные комментарии вложенные', () => {
        expect(
            findSqlSanityProblem(
                '/*\nCREATE TABLE old (\n  id INT /* pk */,\n  name TEXT\n)\n*/\nCREATE TABLE t (a INT);',
                MS
            )
        ).toBeNull();
    });

    it('Oracle: PROMPT / REM / REMARK пропускаются целиком', () => {
        expect(
            findSqlSanityProblem(
                'PROMPT Step 1) create tables\nCREATE TABLE t (a NUMBER);',
                ORA
            )
        ).toBeNull();
        expect(
            findSqlSanityProblem("REM don't\nCREATE TABLE t (a NUMBER);", ORA)
        ).toBeNull();
        expect(
            findSqlSanityProblem(
                "  remark it's (\nCREATE TABLE t (a NUMBER);",
                ORA
            )
        ).toBeNull();
        // ошибка после PROMPT всё ещё находится, с верной строкой
        expect(
            findSqlSanityProblem('PROMPT x)\nCREATE TABLE t (a NUMBER,,);', ORA)
        ).toEqual({ code: 'double-comma', line: 2 });
    });

    it('Oracle: nq-строки', () => {
        expect(
            findSqlSanityProblem(
                "CREATE TABLE t (a VARCHAR2(20) DEFAULT nq'[it's) and it's]');",
                ORA
            )
        ).toBeNull();
        expect(
            findSqlSanityProblem("SELECT NQ'(a ) b)' FROM dual;", ORA)
        ).toBeNull();
    });

    it('PostgreSQL: данные COPY FROM stdin и мета-команды psql', () => {
        expect(
            findSqlSanityProblem(
                'CREATE TABLE t (a INT, b TEXT);\nCOPY public.t (a, b) FROM stdin;\n1\tfoo,,bar\n\\.\n',
                PG
            )
        ).toBeNull();
        expect(
            findSqlSanityProblem(
                'CREATE TABLE t (a INT);\nCOPY public.t (a) FROM stdin;\n1)\n(\n\\.\nCREATE TABLE u (\n a INT,,\n b INT);',
                PG
            )
        ).toEqual({ code: 'double-comma', line: 7 });
        // COPY без завершающего «\.» — не уверены, молчим
        expect(
            findSqlSanityProblem('COPY t (a) FROM stdin;\n1)\n', PG)
        ).toBeNull();
        expect(
            findSqlSanityProblem("\\connect it's\nCREATE TABLE t (a INT);", PG)
        ).toBeNull();
    });

    it('ClickHouse: обратный слэш в строках (два прохода)', () => {
        expect(
            findSqlSanityProblem(
                "CREATE TABLE t (a String COMMENT 'don\\'t ) x') ENGINE = MergeTree ORDER BY a;",
                CH
            )
        ).toBeNull();
        expect(
            findSqlSanityProblem(
                'CREATE TABLE t (a UInt8,, b UInt8) ENGINE = Log;',
                CH
            )
        ).toEqual({ code: 'double-comma', line: 1 });
    });

    it('SQLite: идентификаторы в квадратных скобках', () => {
        expect(
            findSqlSanityProblem('CREATE TABLE t ([weird)] INT, b INT);', LT)
        ).toBeNull();
    });

    it('GENERIC и неизвестные диалекты не проверяются', () => {
        expect(findSqlSanityProblem('CREATE TABLE t (a INT,,,', GN)).toBeNull();
        expect(
            findSqlSanityProblem(
                'CREATE TABLE t (a INT,,,',
                'weird' as DatabaseType
            )
        ).toBeNull();
    });

    it('1 МБ текста сканируется быстро', () => {
        const big =
            "CREATE TABLE t (a INT, b VARCHAR(10) DEFAULT 'x'); -- c\n".repeat(
                18000
            );
        for (const db of [PG, MY, MS, ORA, LT]) {
            const t0 = performance.now();
            findSqlSanityProblem(big, db);
            expect(performance.now() - t0).toBeLessThan(1000);
        }
    });
});
