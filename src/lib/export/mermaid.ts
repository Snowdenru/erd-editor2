import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import { defaultSchemas } from '@/lib/data/default-schemas';
import { transliterate } from './file-name';
import { foreignKeyFieldIds } from './foreign-keys';

const SOURCE_SYMBOL = { one: '||', many: '}o' } as const;
const TARGET_SYMBOL = { one: '||', many: 'o{' } as const;

const quote = (value: string): string =>
    `"${value.replace(/"/g, "'").replace(/\s+/g, ' ').trim()}"`;

// Простые идентификаторы Mermaid оставляем как есть, остальные (кириллица, пробелы, точка) — в кавычках
const entityName = (label: string): string =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(label) ? label : quote(label);

// Имена атрибутов в Mermaid — только латиница, цифры и «_»
const attributeName = (name: string): string => {
    const safe = transliterate(name).replace(/[^A-Za-z0-9_]/g, '_');
    return /^[0-9]/.test(safe) ? `_${safe}` : safe || '_';
};

const typeName = (field: DBField): string => {
    const safe = field.type.name.replace(/[^A-Za-z0-9_-]/g, '_');
    return /^[0-9]/.test(safe) ? `_${safe}` : safe || 'unknown';
};

const attributeLine = (field: DBField, foreignKeys: Set<string>): string => {
    const keys: string[] = [];
    if (field.primaryKey) keys.push('PK');
    if (foreignKeys.has(field.id)) keys.push('FK');
    if (field.unique && !field.primaryKey) keys.push('UK');
    const comment = field.comments?.trim() ? quote(field.comments) : '';
    return [typeName(field), attributeName(field.name), keys.join(','), comment]
        .filter(Boolean)
        .join(' ');
};

export function diagramToMermaid(diagram: Diagram): string {
    const tables = (diagram.tables ?? []).filter((table) => !table.isView);
    const relationships = diagram.relationships ?? [];
    const defaultSchema = defaultSchemas[diagram.databaseType];

    const names = new Map<string, string>();
    const used = new Set<string>();
    for (const table of tables) {
        const base =
            table.schema && table.schema !== defaultSchema
                ? `${table.schema}.${table.name}`
                : table.name;
        const start = base.trim() ? base : 'table';
        let label = start;
        for (let n = 2; used.has(label); n++) {
            label = `${start}_${n}`;
        }
        used.add(label);
        names.set(table.id, entityName(label));
    }

    const foreignKeys = foreignKeyFieldIds(relationships);
    const lines = ['erDiagram'];

    for (const table of tables) {
        const name = names.get(table.id) as string;
        const fields = table.fields.filter((field) => field.name !== '');
        if (fields.length === 0) {
            lines.push(`    ${name}`);
            continue;
        }
        lines.push(`    ${name} {`);
        for (const field of fields) {
            lines.push(`        ${attributeLine(field, foreignKeys)}`);
        }
        lines.push('    }');
    }

    for (const rel of relationships) {
        const source = names.get(rel.sourceTableId);
        const target = names.get(rel.targetTableId);
        if (!source || !target) continue;
        lines.push(
            `    ${source} ${SOURCE_SYMBOL[rel.sourceCardinality]}--${TARGET_SYMBOL[rel.targetCardinality]} ${target} : ${quote(rel.name?.trim() || 'relates')}`
        );
    }

    return `${lines.join('\n')}\n`;
}
