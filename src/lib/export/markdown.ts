import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import { defaultSchemas } from '@/lib/data/default-schemas';
import { databaseTypeToLabelMap } from '@/lib/databases';
import { foreignKeyFieldIds } from './foreign-keys';

const cell = (value: string): string =>
    value.replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ');

// Заголовок `#` должен оставаться одной строкой
const heading = (text: string): string =>
    text.replace(/\r?\n|\r/g, ' ').trim() || 'Без названия';

// Инлайн-код по CommonMark: ограждение длиннее самой длинной серии backtick внутри значения
const inlineCode = (value: string): string => {
    const text = value.replace(/\r?\n|\r/g, ' ');
    const longest = Math.max(
        0,
        ...(text.match(/`+/g) ?? []).map((run) => run.length)
    );
    const fence = '`'.repeat(longest + 1);
    const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
    return `${fence}${pad}${text}${pad}${fence}`;
};

const formatType = (field: DBField): string => {
    let type = field.type.name;
    if (field.characterMaximumLength) {
        type += `(${field.characterMaximumLength})`;
    } else if (field.precision != null) {
        type += `(${field.precision}${field.scale != null ? `,${field.scale}` : ''})`;
    }
    return field.isArray ? `${type}[]` : type;
};

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
        `# ${heading(diagram.name)}`,
        '',
        `${databaseTypeToLabelMap[diagram.databaseType]} · таблиц: ${tables.length} · связей: ${relationships.length}`,
        '',
    ];

    for (const table of tables) {
        lines.push(`## ${heading(titles.get(table.id) ?? '')}`, '');
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
                    field.default ? inlineCode(cell(field.default)) : '',
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
                    `- ${inlineCode(index.name)} (${cell(columns)})${index.unique ? ', уникальный' : ''}`
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
            const name = rel.name ? `, ${cell(rel.name)}` : '';
            lines.push(
                `- ${inlineCode(from)} → ${inlineCode(to)} (${rel.sourceCardinality}:${rel.targetCardinality}${name})`
            );
        }
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}
