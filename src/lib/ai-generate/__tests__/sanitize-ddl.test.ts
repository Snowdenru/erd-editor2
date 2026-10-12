import { describe, expect, it } from 'vitest';
import { sanitizeDdlForAi } from '../sanitize-ddl';

const ddl = `CREATE TABLE [dbo].[users] (
    [id] int NOT NULL,
    -- Почта пользователя
    [email] varchar(255) NOT NULL, -- хвостовой комментарий
    [age] int
);
  -- отступ
SELECT 1;`;

describe('sanitizeDdlForAi', () => {
    it('mssql: убирает строки-комментарии, SQL-строки оставляет', () => {
        const out = sanitizeDdlForAi(ddl, 'mssql');
        expect(out).not.toContain('Почта пользователя');
        expect(out).not.toContain('отступ');
        expect(out).toContain('[email] varchar(255) NOT NULL, -- хвостовой');
        expect(out).toContain('[age] int');
        expect(out).toContain('SELECT 1;');
    });

    it.each(['postgresql', 'mysql', 'sqlite'] as const)(
        '%s: без изменений',
        (dialect) => {
            expect(sanitizeDdlForAi(ddl, dialect)).toBe(ddl);
        }
    );
});
