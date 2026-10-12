import type { AiDialect } from './types';

// Импортёр SQL Server теряет колонку, идущую сразу после строки `-- комментарий` внутри CREATE TABLE
// (так экспортёр пишет комментарии полей), поэтому для mssql такие строки убираем целиком.
export function sanitizeDdlForAi(ddl: string, dialect: AiDialect): string {
    if (dialect !== 'mssql') return ddl;
    return ddl
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
}
