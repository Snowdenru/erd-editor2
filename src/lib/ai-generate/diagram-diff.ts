import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBTable } from '@/lib/domain/db-table';

export interface FieldChange {
    name: string;
    changes: string[];
}

export interface TableDiff {
    name: string;
    status: 'added' | 'removed' | 'changed';
    fieldCount: number;
    addedFields: string[];
    removedFields: string[];
    changedFields: FieldChange[];
    addedIndexes: string[];
    removedIndexes: string[];
}

export interface DiagramDiff {
    tables: TableDiff[];
    addedRelationships: string[];
    removedRelationships: string[];
    isEmpty: boolean;
}

const key = (name: string): string => name.trim().toLowerCase();

const describeFieldChanges = (a: DBField, b: DBField): string[] => {
    const changes: string[] = [];
    if (key(a.type.name) !== key(b.type.name)) {
        changes.push(`тип: ${a.type.name} → ${b.type.name}`);
    }
    const lengthA = a.characterMaximumLength ?? '';
    const lengthB = b.characterMaximumLength ?? '';
    if (lengthA !== lengthB) {
        changes.push(`длина: ${lengthA || '—'} → ${lengthB || '—'}`);
    }
    if (a.nullable !== b.nullable) {
        changes.push(a.nullable ? 'NULL → NOT NULL' : 'NOT NULL → NULL');
    }
    if (a.primaryKey !== b.primaryKey) {
        changes.push(
            a.primaryKey ? 'снят PRIMARY KEY' : 'добавлен PRIMARY KEY'
        );
    }
    if (a.unique !== b.unique) {
        changes.push(a.unique ? 'снят UNIQUE' : 'добавлен UNIQUE');
    }
    if ((a.default ?? '') !== (b.default ?? '')) {
        changes.push(`по умолчанию: ${a.default || '—'} → ${b.default || '—'}`);
    }
    return changes;
};

// Индекс определяется набором колонок и уникальностью, а не именем: модель часто лишь переименовывает индекс
const indexSignature = (
    table: DBTable,
    fieldIds: string[],
    unique: boolean
): string => {
    const names = fieldIds
        .map((id) => table.fields.find((f) => f.id === id)?.name ?? id)
        .map(key)
        .sort();
    return `${unique ? 'u' : 'n'}:${names.join(',')}`;
};

const diffTable = (before: DBTable, after: DBTable): TableDiff => {
    const beforeFields = new Map(before.fields.map((f) => [key(f.name), f]));
    const afterFields = new Map(after.fields.map((f) => [key(f.name), f]));

    const addedFields = after.fields
        .filter((f) => !beforeFields.has(key(f.name)))
        .map((f) => f.name);
    const removedFields = before.fields
        .filter((f) => !afterFields.has(key(f.name)))
        .map((f) => f.name);
    const changedFields: FieldChange[] = [];
    for (const f of after.fields) {
        const old = beforeFields.get(key(f.name));
        if (!old) continue;
        const changes = describeFieldChanges(old, f);
        if (changes.length) changedFields.push({ name: f.name, changes });
    }

    const beforeIdx = new Map(
        before.indexes.map((i) => [
            indexSignature(before, i.fieldIds, i.unique),
            i,
        ])
    );
    const afterIdx = new Map(
        after.indexes.map((i) => [
            indexSignature(after, i.fieldIds, i.unique),
            i,
        ])
    );
    const addedIndexes = [...afterIdx]
        .filter(([s]) => !beforeIdx.has(s))
        .map(([, i]) => i.name);
    const removedIndexes = [...beforeIdx]
        .filter(([s]) => !afterIdx.has(s))
        .map(([, i]) => i.name);

    return {
        name: after.name,
        status: 'changed',
        fieldCount: after.fields.length,
        addedFields,
        removedFields,
        changedFields,
        addedIndexes,
        removedIndexes,
    };
};

const relationshipLabels = (diagram: Diagram): Map<string, string> => {
    const tables = diagram.tables ?? [];
    const result = new Map<string, string>();
    for (const r of diagram.relationships ?? []) {
        const source = tables.find((t) => t.id === r.sourceTableId);
        const target = tables.find((t) => t.id === r.targetTableId);
        const sourceField = source?.fields.find(
            (f) => f.id === r.sourceFieldId
        );
        const targetField = target?.fields.find(
            (f) => f.id === r.targetFieldId
        );
        if (!source || !target || !sourceField || !targetField) continue;
        const label = `${source.name}.${sourceField.name} → ${target.name}.${targetField.name}`;
        result.set(key(label), label);
    }
    return result;
};

export function diffDiagrams(before: Diagram, after: Diagram): DiagramDiff {
    const beforeTables = new Map(
        (before.tables ?? []).map((t) => [key(t.name), t])
    );
    const afterTables = new Map(
        (after.tables ?? []).map((t) => [key(t.name), t])
    );

    const tables: TableDiff[] = [];
    for (const [k, t] of afterTables) {
        const old = beforeTables.get(k);
        if (!old) {
            tables.push({
                name: t.name,
                status: 'added',
                fieldCount: t.fields.length,
                addedFields: [],
                removedFields: [],
                changedFields: [],
                addedIndexes: [],
                removedIndexes: [],
            });
            continue;
        }
        const d = diffTable(old, t);
        if (
            d.addedFields.length ||
            d.removedFields.length ||
            d.changedFields.length ||
            d.addedIndexes.length ||
            d.removedIndexes.length
        ) {
            tables.push(d);
        }
    }
    for (const [k, t] of beforeTables) {
        if (!afterTables.has(k)) {
            tables.push({
                name: t.name,
                status: 'removed',
                fieldCount: t.fields.length,
                addedFields: [],
                removedFields: [],
                changedFields: [],
                addedIndexes: [],
                removedIndexes: [],
            });
        }
    }

    const beforeRels = relationshipLabels(before);
    const afterRels = relationshipLabels(after);
    const addedRelationships = [...afterRels]
        .filter(([k]) => !beforeRels.has(k))
        .map(([, v]) => v);
    const removedRelationships = [...beforeRels]
        .filter(([k]) => !afterRels.has(k))
        .map(([, v]) => v);

    return {
        tables,
        addedRelationships,
        removedRelationships,
        isEmpty:
            tables.length === 0 &&
            addedRelationships.length === 0 &&
            removedRelationships.length === 0,
    };
}
