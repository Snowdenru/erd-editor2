import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { defaultSchemas } from '@/lib/data/default-schemas';
import { databaseTypeToLabelMap } from '@/lib/databases';

const cell = (value: string): string =>
    value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const formatType = (field: DBField): string => {
    let type = field.type.name;
    if (field.characterMaximumLength) {
        type += `(${field.characterMaximumLength})`;
    } else if (field.precision != null) {
        type += `(${field.precision}${field.scale != null ? `,${field.scale}` : ''})`;
    }
    return field.isArray ? `${type}[]` : type;
};

// FK — поле со стороны «много»; если обе стороны одинаковы, целевое поле
const foreignKeyFieldIds = (relationships: DBRelationship[]): Set<string> =>
    new Set(
        relationships.map((rel) =>
            rel.sourceCardinality === 'many' && rel.targetCardinality !== 'many'
                ? rel.sourceFieldId
                : rel.targetFieldId
        )
    );

export function diagramToMarkdown(diagram: Diagram): string {
    const tables = diagram.tables ?? [];
    const relationships = diagram.relationships ?? [];
    const defaultSchema = defaultSchemas[diagram.databaseType];
    const foreignKeys = foreignKeyFieldIds(relationships);

    const titles = new Map(
        tables.map((table) => [
            table.id,
            table.schema && table.schema !== defaultSchema
                ? `${table.schema}.${table.name}`
                : table.name,
        ])
    );
    const fieldNames = new Map(
        tables.flatMap((table) =>
            table.fields.map((field) => [field.id, field.name] as const)
        )
    );

    const lines: string[] = [
        `# ${diagram.name}`,
        '',
        `${databaseTypeToLabelMap[diagram.databaseType]} · таблиц: ${tables.length} · связей: ${relationships.length}`,
        '',
    ];

    for (const table of tables) {
        lines.push(`## ${titles.get(table.id)}`, '');
        if (table.comments?.trim()) {
            lines.push(cell(table.comments), '');
        }
        lines.push(
            '| Поле | Тип | Ключ | NULL | По умолчанию | Описание |',
            '|---|---|---|---|---|---|'
        );
        for (const field of table.fields.filter((f) => f.name !== '')) {
            const keys: string[] = [];
            if (field.primaryKey) keys.push('PK');
            if (foreignKeys.has(field.id)) keys.push('FK');
            if (field.unique && !field.primaryKey) keys.push('UK');
            lines.push(
                `| ${[
                    cell(field.name),
                    cell(formatType(field)),
                    keys.join(', '),
                    field.nullable ? 'да' : 'нет',
                    field.default ? `\`${cell(field.default)}\`` : '',
                    cell(field.comments ?? ''),
                ].join(' | ')} |`
            );
        }
        lines.push('');

        if (table.indexes.length > 0) {
            lines.push('**Индексы:**', '');
            for (const index of table.indexes) {
                const columns = index.fieldIds
                    .map((id) => fieldNames.get(id) ?? id)
                    .join(', ');
                lines.push(
                    `- \`${index.name}\` (${columns})${index.unique ? ', уникальный' : ''}`
                );
            }
            lines.push('');
        }
    }

    if (relationships.length > 0) {
        lines.push('## Связи', '');
        for (const rel of relationships) {
            const from = `${titles.get(rel.sourceTableId) ?? '?'}.${fieldNames.get(rel.sourceFieldId) ?? '?'}`;
            const to = `${titles.get(rel.targetTableId) ?? '?'}.${fieldNames.get(rel.targetFieldId) ?? '?'}`;
            const name = rel.name ? `, ${rel.name}` : '';
            lines.push(
                `- \`${from}\` → \`${to}\` (${rel.sourceCardinality}:${rel.targetCardinality}${name})`
            );
        }
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}
