import type { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { parseSQLError, sqlImportToDiagram } from '@/lib/data/sql-import';
import {
    validateSQL,
    type ValidationResult,
} from '@/lib/data/sql-import/sql-validator';

export type DdlParseResult =
    | { status: 'empty' }
    | { status: 'no-tables'; validation: ValidationResult }
    | { status: 'error'; message: string; validation: ValidationResult }
    | { status: 'ok'; diagram: Diagram; validation: ValidationResult };

export const parseDdl = async (
    sql: string,
    databaseType: DatabaseType
): Promise<DdlParseResult> => {
    if (!sql.trim()) {
        return { status: 'empty' };
    }

    const validation = validateSQL(sql, databaseType);

    // Те же правила, что в диалоге импорта: ошибки с автоисправлением
    // не парсим, остальные отдаём парсеру
    if (validation.fixedSQL && validation.errors.length > 0) {
        return {
            status: 'error',
            message: validation.errors[0].message,
            validation,
        };
    }

    const check = await parseSQLError({
        sqlContent: sql,
        sourceDatabaseType: databaseType,
    });
    if (!check.success) {
        return {
            status: 'error',
            message: check.error ?? 'SQL contains syntax errors',
            validation,
        };
    }

    try {
        const diagram = await sqlImportToDiagram({
            sqlContent: sql,
            sourceDatabaseType: databaseType,
            targetDatabaseType: databaseType,
        });
        const tableCount = diagram.tables?.length ?? 0;
        const relationshipCount = diagram.relationships?.length ?? 0;
        const counted = { ...validation, tableCount, relationshipCount };

        if (tableCount === 0) {
            return { status: 'no-tables', validation: counted };
        }
        return { status: 'ok', diagram, validation: counted };
    } catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
            validation,
        };
    }
};

// Id, имя, тип БД, даты создания, области и заметки остаются от текущей диаграммы;
// содержимое (таблицы, связи, зависимости, типы) берётся из SQL
export const replaceDiagramContent = (
    current: Diagram,
    parsed: Diagram
): Diagram => ({
    ...current,
    tables: parsed.tables ?? [],
    relationships: parsed.relationships ?? [],
    dependencies: parsed.dependencies ?? [],
    customTypes: parsed.customTypes ?? [],
    updatedAt: new Date(),
});
