/**
 * Deterministic exporter for MySQL/MariaDB diagrams to PostgreSQL DDL.
 * Mirrors ../postgresql/to-mysql.ts (the reverse direction) in structure and
 * conventions, converting MySQL-specific types and features to PostgreSQL
 * equivalents, with comments for features that cannot be fully converted.
 */

import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import {
    exportFieldComment,
    escapeSQLComment,
    formatTableComment,
    isFunction,
    isKeyword,
    strHasQuotes,
} from '../common';
import {
    mysqlIndexTypeToPostgreSQL,
    getTypeMapping,
    getFallbackTypeMapping,
} from './type-mappings';
import { formatWarningsHeader } from '../unsupported-features';
import { detectMySQLUnsupportedFeatures } from './unsupported-features';

/**
 * Convert a MySQL default value to a PostgreSQL equivalent
 */
function convertMySQLDefaultToPostgres(field: DBField): string {
    if (!field.default) {
        return '';
    }

    const defaultValue = field.default.trim();
    const defaultLower = defaultValue.toLowerCase();

    if (defaultLower.includes('auto_increment')) {
        return '';
    }

    // MySQL's ON UPDATE CURRENT_TIMESTAMP has no PostgreSQL column-level
    // equivalent - drop the clause, keep only the initial DEFAULT (the
    // dropped behavior is surfaced separately via the warnings header)
    const withoutOnUpdate = defaultValue
        .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(\(\d+\))?/i, '')
        .trim();
    const withoutOnUpdateLower = withoutOnUpdate.toLowerCase();

    if (
        withoutOnUpdateLower === 'current_timestamp' ||
        withoutOnUpdateLower === 'now()'
    ) {
        return 'CURRENT_TIMESTAMP';
    }

    if (withoutOnUpdateLower === 'uuid()') {
        return 'gen_random_uuid()';
    }

    if (isFunction(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    if (isKeyword(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    if (strHasQuotes(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    if (/^-?\d+(\.\d+)?$/.test(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    return `'${withoutOnUpdate.replace(/'/g, "''")}'`;
}

/**
 * Map a MySQL type to a PostgreSQL type with size/precision handling
 */
function mapMySQLTypeToPostgres(field: DBField): {
    typeName: string;
    inlineComment: string | null;
} {
    const originalType = field.type.name.toLowerCase();

    const mapping = getTypeMapping(originalType, 'postgresql');
    const effectiveMapping = mapping || getFallbackTypeMapping('postgresql');

    let typeName = effectiveMapping.targetType;

    if (field.characterMaximumLength) {
        if (typeName === 'varchar' || typeName === 'char') {
            typeName = `${typeName}(${field.characterMaximumLength})`;
        }
    } else if (effectiveMapping.defaultLength) {
        if (typeName === 'varchar' || typeName === 'char') {
            typeName = `${typeName}(${effectiveMapping.defaultLength})`;
        }
    }

    if (field.precision !== undefined && field.scale !== undefined) {
        if (typeName === 'numeric') {
            typeName = `numeric(${field.precision}, ${field.scale})`;
        }
    } else if (field.precision !== undefined) {
        if (typeName === 'numeric') {
            typeName = `numeric(${field.precision})`;
        }
    } else if (
        effectiveMapping.defaultPrecision !== undefined &&
        typeName === 'numeric'
    ) {
        typeName = `numeric(${effectiveMapping.defaultPrecision}, ${effectiveMapping.defaultScale || 0})`;
    }

    const inlineComment = effectiveMapping.includeInlineComment
        ? `Was: ${field.type.name}`
        : null;

    return { typeName, inlineComment };
}

/**
 * A field becomes a serial/bigserial/smallserial column when it is
 * auto-incrementing and its mapped type is one PostgreSQL's serial pseudo-
 * types cover - matching the convention the native PostgreSQL exporter uses
 * (see export-per-type/postgresql.ts).
 */
function isAutoIncrement(field: DBField): boolean {
    if (field.increment) {
        return true;
    }
    return Boolean(field.default?.toLowerCase().includes('auto_increment'));
}

function serialTypeFor(typeName: string): string | null {
    switch (typeName) {
        case 'integer':
            return 'serial';
        case 'bigint':
            return 'bigserial';
        case 'smallint':
            return 'smallserial';
        default:
            return null;
    }
}

/**
 * Main export function: MySQL/MariaDB diagram to PostgreSQL DDL
 */
export function exportMySQLToPostgreSQL({
    diagram,
    onlyRelationships = false,
}: {
    diagram: Diagram;
    onlyRelationships?: boolean;
}): string {
    if (!diagram.tables || !diagram.relationships) {
        return '';
    }

    const tables = diagram.tables;
    const relationships = diagram.relationships;

    const unsupportedFeatures = detectMySQLUnsupportedFeatures(
        diagram,
        'postgresql'
    );

    let sqlScript = formatWarningsHeader(
        unsupportedFeatures,
        'MySQL',
        'PostgreSQL'
    );

    if (!onlyRelationships) {
        const schemas = new Set<string>();
        tables.forEach((table) => {
            if (table.schema) {
                schemas.add(table.schema);
            }
        });

        schemas.forEach((schema) => {
            sqlScript += `CREATE SCHEMA IF NOT EXISTS "${schema}";\n`;
        });

        if (schemas.size > 0) {
            sqlScript += '\n';
        }

        sqlScript += tables
            .map((table: DBTable) => {
                if (table.isView) {
                    return '';
                }

                const tableName = table.schema
                    ? `"${table.schema}"."${table.name}"`
                    : `"${table.name}"`;

                const primaryKeyFields = table.fields.filter(
                    (f) => f.primaryKey
                );

                const validCheckConstraints = (
                    table.checkConstraints ?? []
                ).filter((c) => c.expression && c.expression.trim());
                const hasFollowingConstraints =
                    primaryKeyFields.length > 0 ||
                    validCheckConstraints.length > 0;

                const fieldDefinitions = table.fields.map(
                    (field: DBField, index: number, allFields: DBField[]) => {
                        const fieldName = `"${field.name}"`;

                        const { typeName: mappedType, inlineComment } =
                            mapMySQLTypeToPostgres(field);

                        const autoIncrement = isAutoIncrement(field);
                        const serialType = autoIncrement
                            ? serialTypeFor(mappedType)
                            : null;
                        const typeName = serialType || mappedType;

                        const notNull = field.nullable ? '' : ' NOT NULL';

                        const unique =
                            !field.primaryKey && field.unique ? ' UNIQUE' : '';

                        const convertedDefault =
                            convertMySQLDefaultToPostgres(field);
                        const defaultValue =
                            convertedDefault && !serialType
                                ? ` DEFAULT ${convertedDefault}`
                                : '';

                        const sqlInlineComment = inlineComment
                            ? ` -- ${inlineComment}`
                            : '';

                        const isLastField = index === allFields.length - 1;
                        const needsComma =
                            !isLastField || hasFollowingConstraints;

                        return `${exportFieldComment(field.comments ?? '')}    ${fieldName} ${typeName}${notNull}${unique}${defaultValue}${needsComma ? ',' : ''}${sqlInlineComment}`;
                    }
                );

                return `${
                    table.comments ? formatTableComment(table.comments) : ''
                }\nCREATE TABLE IF NOT EXISTS ${tableName} (\n${fieldDefinitions.join('\n')}${
                    primaryKeyFields.length > 0
                        ? `\n    PRIMARY KEY (${primaryKeyFields
                              .map((f) => `"${f.name}"`)
                              .join(
                                  ', '
                              )})${validCheckConstraints.length > 0 ? ',' : ''}`
                        : ''
                }${
                    validCheckConstraints.length > 0
                        ? validCheckConstraints
                              .map(
                                  (constraint, index) =>
                                      `${index > 0 ? ',' : ''}\n    CHECK (${constraint.expression})`
                              )
                              .join('')
                        : ''
                }\n);${
                    table.comments
                        ? `\nCOMMENT ON TABLE ${tableName} IS '${escapeSQLComment(table.comments)}';`
                        : ''
                }${table.fields
                    .filter((f) => f.comments)
                    .map(
                        (f) =>
                            `\nCOMMENT ON COLUMN ${tableName}."${f.name}" IS '${escapeSQLComment(f.comments ?? '')}';`
                    )
                    .join('')}${
                    // Add indexes
                    (() => {
                        const validIndexes = table.indexes
                            .map((index) => {
                                if (index.isPrimaryKey) {
                                    return '';
                                }

                                const indexFields = index.fieldIds
                                    .map((fieldId) =>
                                        table.fields.find(
                                            (f) => f.id === fieldId
                                        )
                                    )
                                    .filter(Boolean);

                                if (
                                    primaryKeyFields.length ===
                                        indexFields.length &&
                                    primaryKeyFields.every((pk) =>
                                        indexFields.some(
                                            (field) =>
                                                field && field.id === pk.id
                                        )
                                    )
                                ) {
                                    return '';
                                }

                                const indexType = (
                                    index.type || 'btree'
                                ).toLowerCase();
                                const indexTypeMapping =
                                    mysqlIndexTypeToPostgreSQL[indexType];
                                const indexInlineComment =
                                    indexTypeMapping?.note ?? null;

                                const fieldNamesForIndex = indexFields
                                    .map((field) => field?.name || '')
                                    .join('_');
                                const uniqueIndicator = index.unique
                                    ? '_unique'
                                    : '';
                                const indexName = `"idx_${table.name}_${fieldNamesForIndex}${uniqueIndicator}"`;

                                const indexFieldNames = indexFields
                                    .map((field) =>
                                        field ? `"${field.name}"` : ''
                                    )
                                    .filter(Boolean);

                                const indexTypeStr =
                                    indexTypeMapping?.targetType &&
                                    indexTypeMapping.targetType !== 'btree'
                                        ? ` USING ${indexTypeMapping.targetType}`
                                        : '';

                                const commentStr = indexInlineComment
                                    ? ` -- ${indexInlineComment}`
                                    : '';

                                return indexFieldNames.length > 0
                                    ? `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${indexName} ON ${tableName}${indexTypeStr} (${indexFieldNames.join(', ')});${commentStr}`
                                    : '';
                            })
                            .filter(Boolean)
                            .sort((a, b) => a.localeCompare(b));

                        return validIndexes.length > 0
                            ? `\n-- Indexes\n${validIndexes.join('\n')}`
                            : '';
                    })()
                }`;
            })
            .filter(Boolean)
            .join('\n');
    }

    if (relationships.length > 0) {
        sqlScript += '\n-- Foreign key constraints\n';

        const foreignKeys = relationships
            .map((r: DBRelationship) => {
                const sourceTable = tables.find(
                    (t) => t.id === r.sourceTableId
                );
                const targetTable = tables.find(
                    (t) => t.id === r.targetTableId
                );

                if (
                    !sourceTable ||
                    !targetTable ||
                    sourceTable.isView ||
                    targetTable.isView
                ) {
                    return '';
                }

                const sourceField = sourceTable.fields.find(
                    (f) => f.id === r.sourceFieldId
                );
                const targetField = targetTable.fields.find(
                    (f) => f.id === r.targetFieldId
                );

                if (!sourceField || !targetField) {
                    return '';
                }

                let fkTable, fkField, refTable, refField;

                if (
                    r.sourceCardinality === 'many' &&
                    r.targetCardinality === 'many'
                ) {
                    return '';
                } else if (
                    r.sourceCardinality === 'many' &&
                    r.targetCardinality === 'one'
                ) {
                    fkTable = sourceTable;
                    fkField = sourceField;
                    refTable = targetTable;
                    refField = targetField;
                } else {
                    fkTable = targetTable;
                    fkField = targetField;
                    refTable = sourceTable;
                    refField = sourceField;
                }

                const fkTableName = fkTable.schema
                    ? `"${fkTable.schema}"."${fkTable.name}"`
                    : `"${fkTable.name}"`;
                const refTableName = refTable.schema
                    ? `"${refTable.schema}"."${refTable.name}"`
                    : `"${refTable.name}"`;

                const constraintName = `fk_${fkTable.name}_${fkField.name}`;

                return `ALTER TABLE ${fkTableName} ADD CONSTRAINT "${constraintName}" FOREIGN KEY("${fkField.name}") REFERENCES ${refTableName}("${refField.name}");`;
            })
            .filter(Boolean);

        sqlScript += foreignKeys.join('\n');
    }

    return sqlScript;
}
