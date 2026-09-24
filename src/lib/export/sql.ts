import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import { hasCrossDialectSupport } from '@/lib/data/sql-export/cross-dialect';

export const SQL_TARGETS: DatabaseType[] = [
    DatabaseType.GENERIC,
    DatabaseType.POSTGRESQL,
    DatabaseType.MYSQL,
    DatabaseType.MARIADB,
    DatabaseType.SQL_SERVER,
    DatabaseType.SQLITE,
    DatabaseType.ORACLE,
    DatabaseType.COCKROACHDB,
    DatabaseType.CLICKHOUSE,
];

// Диалекты, для которых в exportBaseSQL есть собственный экспортёр
const NATIVE_DIALECTS = new Set<DatabaseType>([
    DatabaseType.POSTGRESQL,
    DatabaseType.MYSQL,
    DatabaseType.MARIADB,
    DatabaseType.SQL_SERVER,
    DatabaseType.SQLITE,
]);

// Без ИИ: Generic, свой диалект схемы (если он нативный) и детерминированные конверсии из PostgreSQL
export const isSqlTargetAvailable = (
    source: DatabaseType,
    target: DatabaseType
): boolean =>
    target === DatabaseType.GENERIC ||
    (source === target && NATIVE_DIALECTS.has(target)) ||
    hasCrossDialectSupport(source, target);

export const pickDefaultSqlTarget = (source: DatabaseType): DatabaseType =>
    source !== DatabaseType.GENERIC && isSqlTargetAvailable(source, source)
        ? source
        : DatabaseType.GENERIC;

// exportBaseSQL при выравнивании типов внешних ключей может менять переданную схему — работаем с копией
const clone = <T>(value: T): T =>
    typeof structuredClone === 'function'
        ? structuredClone(value)
        : (JSON.parse(JSON.stringify(value)) as T);

export const generateSql = (diagram: Diagram, target: DatabaseType): string =>
    exportBaseSQL({ diagram: clone(diagram), targetDatabaseType: target });
