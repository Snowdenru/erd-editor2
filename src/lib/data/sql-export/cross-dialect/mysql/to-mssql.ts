/**
 * Deterministic exporter for MySQL/MariaDB diagrams to SQL Server DDL.
 * Mirrors ../postgresql/to-mssql.ts in structure and conventions, converting
 * MySQL-specific types and features to SQL Server equivalents, with comments
 * for features that cannot be fully converted.
 */

import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import {
    exportFieldComment,
    formatMSSQLTableComment,
    isFunction,
    isKeyword,
    strHasQuotes,
} from '../common';
import {
    mysqlIndexTypeToSQLServer,
    getTypeMapping,
    getFallbackTypeMapping,
} from './type-mappings';
import { formatWarningsHeader } from '../unsupported-features';
import { detectMySQLUnsupportedFeatures } from './unsupported-features';

/**
 * Convert a MySQL default value to a SQL Server equivalent
 */
function convertMySQLDefaultToMSSQL(field: DBField): string {
    if (!field.default) {
        return '';
    }

    const defaultValue = field.default.trim();
    const defaultLower = defaultValue.toLowerCase();

    if (defaultLower.includes('auto_increment')) {
        return '';
    }

    const withoutOnUpdate = defaultValue
        .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(\(\d+\))?/i, '')
        .trim();
    const withoutOnUpdateLower = withoutOnUpdate.toLowerCase();

    if (
        withoutOnUpdateLower === 'current_timestamp' ||
        withoutOnUpdateLower === 'now()'
    ) {
        return 'GETDATE()';
    }

    if (withoutOnUpdateLower === 'uuid()') {
        return 'NEWID()';
    }

    if (withoutOnUpdateLower === 'true') {
        return '1';
    }
    if (withoutOnUpdateLower === 'false') {
        return '0';
    }

    if (isFunction(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    if (isKeyword(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    if (strHasQuotes(withoutOnUpdate)) {
        if (withoutOnUpdate.startsWith("'") && withoutOnUpdate.endsWith("'")) {
            return `N${withoutOnUpdate}`;
        }
        return withoutOnUpdate;
    }

    if (/^-?\d+(\.\d+)?$/.test(withoutOnUpdate)) {
        return withoutOnUpdate;
    }

    return `N'${withoutOnUpdate.replace(/'/g, "''")}'`;
}

/**
 * Map a MySQL type to a SQL Server type with size/precision handling
 */
function mapMySQLTypeToMSSQL(
    field: DBField,
    isIndexed: boolean = false
): {
    typeName: string;
    inlineComment: string | null;
} {
    const originalType = field.type.name.toLowerCase();

    const mapping = getTypeMapping(originalType, 'sqlserver');
    const effectiveMapping = mapping || getFallbackTypeMapping('sqlserver');

    let typeName = effectiveMapping.targetType;
    let inlineComment: string | null = null;

    // SQL Server cannot use a (MAX) type as an index key
    if (isIndexed && typeName.includes('(MAX)')) {
        typeName = typeName.replace('(MAX)', '(450)');
        inlineComment = `Was: ${field.type.name} (size limited for index)`;
    }

    if (field.characterMaximumLength) {
        if (
            typeName === 'NVARCHAR' ||
            typeName === 'NCHAR' ||
            typeName === 'VARBINARY' ||
            typeName === 'BINARY'
        ) {
            typeName = `${typeName}(${field.characterMaximumLength})`;
        }
    } else if (effectiveMapping.defaultLength) {
        if (
            typeName === 'NVARCHAR' ||
            typeName === 'NCHAR' ||
            typeName === 'BINARY'
        ) {
            typeName = `${typeName}(${effectiveMapping.defaultLength})`;
        }
    }

    if (field.precision !== undefined && field.scale !== undefined) {
        if (typeName === 'DECIMAL') {
            typeName = `DECIMAL(${field.precision}, ${field.scale})`;
        }
    } else if (field.precision !== undefined) {
        if (typeName === 'DECIMAL') {
            typeName = `DECIMAL(${field.precision})`;
        }
    } else if (
        effectiveMapping.defaultPrecision !== undefined &&
        typeName === 'DECIMAL'
    ) {
        typeName = `DECIMAL(${effectiveMapping.defaultPrecision}, ${effectiveMapping.defaultScale || 0})`;
    }

    if (effectiveMapping.includeInlineComment && !inlineComment) {
        inlineComment = `Was: ${field.type.name}`;
    }

    return { typeName, inlineComment };
}

function isIdentity(field: DBField): boolean {
    if (field.increment) {
        return true;
    }
    return Boolean(field.default?.toLowerCase().includes('auto_increment'));
}

/**
 * Main export function: MySQL/MariaDB diagram to SQL Server DDL
 */
export function exportMySQLToMSSQL({
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
        'sqlserver'
    );

    let sqlScript = formatWarningsHeader(
        unsupportedFeatures,
        'MySQL',
        'SQL Server'
    );

    if (!onlyRelationships) {
        const schemas = new Set<string>();
        tables.forEach((table) => {
            if (table.schema) {
                schemas.add(table.schema);
            }
        });

        schemas.forEach((schema) => {
            sqlScript += `IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '${schema}')\nBEGIN\n    EXEC('CREATE SCHEMA [${schema}]');\nEND;\nGO\n`;
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
                    ? `[${table.schema}].[${table.name}]`
                    : `[${table.name}]`;

                const primaryKeyFields = table.fields.filter(
                    (f) => f.primaryKey
                );

                const validCheckConstraints = (
                    table.checkConstraints ?? []
                ).filter((c) => c.expression && c.expression.trim());
                const hasFollowingConstraints =
                    primaryKeyFields.length > 0 ||
                    validCheckConstraints.length > 0;

                const indexedFieldIds = new Set<string>();
                table.indexes.forEach((idx) => {
                    idx.fieldIds.forEach((fieldId) => {
                        indexedFieldIds.add(fieldId);
                    });
                });
                primaryKeyFields.forEach((f) => {
                    indexedFieldIds.add(f.id);
                });
                table.fields.forEach((f) => {
                    if (f.unique) {
                        indexedFieldIds.add(f.id);
                    }
                });

                const fieldDefinitions = table.fields.map(
                    (field: DBField, index: number, allFields: DBField[]) => {
                        const fieldName = `[${field.name}]`;
                        const isIndexed = indexedFieldIds.has(field.id);

                        const { typeName, inlineComment } =
                            mapMySQLTypeToMSSQL(field, isIndexed);

                        const notNull = field.nullable ? '' : ' NOT NULL';

                        const identity = isIdentity(field)
                            ? ' IDENTITY(1,1)'
                            : '';

                        const unique =
                            !field.primaryKey && field.unique ? ' UNIQUE' : '';

                        const convertedDefault =
                            convertMySQLDefaultToMSSQL(field);
                        const defaultValue =
                            convertedDefault && !identity
                                ? ` DEFAULT ${convertedDefault}`
                                : '';

                        const sqlInlineComment = inlineComment
                            ? ` -- ${inlineComment}`
                            : '';

                        const isLastField = index === allFields.length - 1;
                        const needsComma =
                            !isLastField || hasFollowingConstraints;

                        return `${exportFieldComment(field.comments ?? '')}    ${fieldName} ${typeName}${notNull}${identity}${unique}${defaultValue}${needsComma ? ',' : ''}${sqlInlineComment}`;
                    }
                );

                return `${
                    table.comments
                        ? formatMSSQLTableComment(table.comments)
                        : ''
                }CREATE TABLE ${tableName} (\n${fieldDefinitions.join('\n')}${
                    primaryKeyFields.length > 0
                        ? `\n    PRIMARY KEY (${primaryKeyFields
                              .map((f) => `[${f.name}]`)
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
                }\n);\nGO${
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
                                    mysqlIndexTypeToSQLServer[indexType];
                                const indexInlineComment =
                                    indexTypeMapping?.note ?? null;

                                const indexName = table.schema
                                    ? `[${table.schema}_${index.name}]`
                                    : `[${index.name}]`;

                                const indexFieldNames = indexFields
                                    .map((field) =>
                                        field ? `[${field.name}]` : ''
                                    )
                                    .filter(Boolean);

                                if (indexFieldNames.length > 32) {
                                    indexFieldNames.length = 32;
                                }

                                const commentStr = indexInlineComment
                                    ? ` -- ${indexInlineComment}`
                                    : '';

                                return indexFieldNames.length > 0
                                    ? `CREATE ${index.unique ? 'UNIQUE ' : ''}${indexTypeMapping?.targetType === 'CLUSTERED' ? 'CLUSTERED ' : 'NONCLUSTERED '}INDEX ${indexName} ON ${tableName} (${indexFieldNames.join(', ')});${commentStr}`
                                    : '';
                            })
                            .filter(Boolean)
                            .sort((a, b) => a.localeCompare(b));

                        return validIndexes.length > 0
                            ? `\n-- Indexes\n${validIndexes.join('\nGO\n')}\nGO`
                            : '';
                    })()
                }`;
            })
            .filter(Boolean)
            .join('\n');

        const commentStatements: string[] = [];
        for (const table of tables) {
            if (table.isView) continue;

            const schemaName = table.schema || 'dbo';

            if (table.comments) {
                commentStatements.push(
                    `EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${table.comments.replace(/'/g, "''")}', @level0type=N'SCHEMA', @level0name=N'${schemaName}', @level1type=N'TABLE', @level1name=N'${table.name}';`
                );
            }

            for (const field of table.fields) {
                if (field.comments) {
                    commentStatements.push(
                        `EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${field.comments.replace(/'/g, "''")}', @level0type=N'SCHEMA', @level0name=N'${schemaName}', @level1type=N'TABLE', @level1name=N'${table.name}', @level2type=N'COLUMN', @level2name=N'${field.name}';`
                    );
                }
            }
        }

        if (commentStatements.length > 0) {
            sqlScript += '\n-- Table and column descriptions\n';
            sqlScript += commentStatements.join('\nGO\n');
            sqlScript += '\nGO\n';
        }
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
                    return null;
                }

                const sourceField = sourceTable.fields.find(
                    (f) => f.id === r.sourceFieldId
                );
                const targetField = targetTable.fields.find(
                    (f) => f.id === r.targetFieldId
                );

                if (!sourceField || !targetField) {
                    return null;
                }

                let fkTable, fkField, refTable, refField;

                if (
                    r.sourceCardinality === 'many' &&
                    r.targetCardinality === 'many'
                ) {
                    return null;
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
                    ? `[${fkTable.schema}].[${fkTable.name}]`
                    : `[${fkTable.name}]`;
                const refTableName = refTable.schema
                    ? `[${refTable.schema}].[${refTable.name}]`
                    : `[${refTable.name}]`;

                return {
                    schema: fkTable.schema || 'dbo',
                    sql: `ALTER TABLE ${fkTableName} ADD CONSTRAINT [${r.name || `fk_${fkTable.name}_${fkField.name}`}] FOREIGN KEY([${fkField.name}]) REFERENCES ${refTableName}([${refField.name}]);`,
                };
            })
            .filter(Boolean) as { schema: string; sql: string }[];

        const fksBySchema = foreignKeys.reduce(
            (acc, fk) => {
                if (!acc[fk.schema]) {
                    acc[fk.schema] = [];
                }
                acc[fk.schema].push(fk.sql);
                return acc;
            },
            {} as Record<string, string[]>
        );

        const sortedSchemas = Object.keys(fksBySchema).sort();
        const fkSql = sortedSchemas
            .map((schema, index) => {
                const schemaFks = fksBySchema[schema].join('\nGO\n');
                return index === 0
                    ? `-- Schema: ${schema}\n${schemaFks}`
                    : `\n-- Schema: ${schema}\n${schemaFks}`;
            })
            .join('\n');

        sqlScript += fkSql;
        sqlScript += '\nGO\n';
    }

    return sqlScript;
}
