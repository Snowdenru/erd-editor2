/**
 * Detects MySQL/MariaDB features that cannot be fully converted to target
 * dialects. Used to generate warning comments in cross-dialect exports.
 *
 * Sibling of ../unsupported-features.ts (which covers PostgreSQL as the
 * source dialect) - kept separate because the two source dialects have
 * different quirks and neither the diagram model nor the checks overlap
 * enough to share code cleanly.
 */

import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { UnsupportedFeature } from '../unsupported-features';
import {
    getTypeMapping,
    mysqlIndexTypeToPostgreSQL,
    mysqlIndexTypeToSQLServer,
} from './type-mappings';

type MySQLTargetDialect = 'postgresql' | 'sqlserver';

/**
 * Detect all unsupported MySQL/MariaDB features when converting to a target dialect
 */
export function detectMySQLUnsupportedFeatures(
    diagram: Diagram,
    targetDialect: MySQLTargetDialect
): UnsupportedFeature[] {
    const features: UnsupportedFeature[] = [];

    if (diagram.tables) {
        for (const table of diagram.tables) {
            if (table.isView) continue;
            features.push(...detectFieldIssues(table, targetDialect));
            features.push(...detectIndexIssues(table, targetDialect));
        }
    }

    return features;
}

function detectFieldIssues(
    table: DBTable,
    targetDialect: MySQLTargetDialect
): UnsupportedFeature[] {
    const features: UnsupportedFeature[] = [];
    const tableName = table.schema
        ? `${table.schema}.${table.name}`
        : table.name;

    for (const field of table.fields) {
        const typeName = field.type.name.toLowerCase();

        const mapping = getTypeMapping(typeName, targetDialect);
        if (mapping?.conversionNote) {
            features.push({
                type: 'type',
                tableName,
                objectName: field.name,
                feature: `Type: ${typeName}`,
                recommendation: mapping.conversionNote,
            });
        }

        if (
            field.default?.toLowerCase().includes('on update current_timestamp')
        ) {
            features.push({
                type: 'default',
                tableName,
                objectName: field.name,
                feature: 'ON UPDATE CURRENT_TIMESTAMP',
                recommendation:
                    targetDialect === 'postgresql'
                        ? 'Dropped: PostgreSQL has no column-level auto-update-on-write clause. Add a BEFORE UPDATE trigger that sets the column to CURRENT_TIMESTAMP'
                        : 'Dropped: SQL Server has no column-level auto-update-on-write clause. Add an AFTER UPDATE trigger or a computed column',
            });
        }

        if (
            field.increment ||
            field.default?.toLowerCase().includes('auto_increment')
        ) {
            features.push({
                type: 'default',
                tableName,
                objectName: field.name,
                feature: 'AUTO_INCREMENT',
                recommendation:
                    targetDialect === 'postgresql'
                        ? 'Converted to a serial/identity column.'
                        : 'Converted to IDENTITY(1,1).',
            });
        }
    }

    return features;
}

function detectIndexIssues(
    table: DBTable,
    targetDialect: MySQLTargetDialect
): UnsupportedFeature[] {
    const features: UnsupportedFeature[] = [];
    const tableName = table.schema
        ? `${table.schema}.${table.name}`
        : table.name;

    const indexTypeMap =
        targetDialect === 'postgresql'
            ? mysqlIndexTypeToPostgreSQL
            : mysqlIndexTypeToSQLServer;

    for (const index of table.indexes) {
        if (index.isPrimaryKey) continue;

        const indexType = (index.type || 'btree').toLowerCase();
        const mapping = indexTypeMap[indexType];

        if (mapping?.note) {
            features.push({
                type: 'index',
                tableName,
                objectName: index.name,
                feature: `${indexType.toUpperCase()} index`,
                recommendation: mapping.note,
            });
        }
    }

    return features;
}
