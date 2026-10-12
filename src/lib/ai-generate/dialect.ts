import { DatabaseType } from '@/lib/domain/database-type';
import type { AiDialect } from './types';

export const AI_DIALECT_OPTIONS: { label: string; value: AiDialect }[] = [
    { label: 'PostgreSQL', value: 'postgresql' },
    { label: 'MySQL', value: 'mysql' },
    { label: 'SQL Server', value: 'mssql' },
    { label: 'SQLite', value: 'sqlite' },
];

// Диалекты, которых нет у бэкенда (Oracle, ClickHouse, generic), честно сводим к PostgreSQL.
export function toApiDialect(type: DatabaseType): AiDialect {
    switch (type) {
        case DatabaseType.MYSQL:
        case DatabaseType.MARIADB:
            return 'mysql';
        case DatabaseType.SQL_SERVER:
            return 'mssql';
        case DatabaseType.SQLITE:
            return 'sqlite';
        default:
            return 'postgresql';
    }
}

// Диалекты, которые ИИ-проверка схемы понимает: у остальных экспорт пишет типы, чуждые PostgreSQL
export function isRefineDialectSupported(type: DatabaseType): boolean {
    return (
        type === DatabaseType.POSTGRESQL ||
        type === DatabaseType.MYSQL ||
        type === DatabaseType.MARIADB ||
        type === DatabaseType.SQL_SERVER ||
        type === DatabaseType.SQLITE
    );
}

export function toDatabaseType(dialect: AiDialect): DatabaseType {
    switch (dialect) {
        case 'mysql':
            return DatabaseType.MYSQL;
        case 'mssql':
            return DatabaseType.SQL_SERVER;
        case 'sqlite':
            return DatabaseType.SQLITE;
        default:
            return DatabaseType.POSTGRESQL;
    }
}
