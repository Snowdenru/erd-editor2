import type { Diagram } from '@/lib/domain/diagram';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DBField } from '@/lib/domain/db-field';
import type { DBTable } from '@/lib/domain/db-table';
import {
    indexSignature,
    isPkIndex,
    key,
    matchTables,
    tableLabel,
} from './diagram-keys';

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
    // комментарий таблицы и CHECK-ограничения
    otherChanges: string[];
}

export interface DiagramDiff {
    tables: TableDiff[];
    addedRelationships: string[];
    removedRelationships: string[];
    addedTypes: string[];
    changedTypes: string[];
    isEmpty: boolean;
}

// Один и тот же тип в разных написаниях: импорт возвращает int там, где в схеме integer
const TYPE_ALIASES: Record<string, string> = {
    int: 'integer',
    int4: 'integer',
    int8: 'bigint',
    int2: 'smallint',
    bool: 'boolean',
    'character varying': 'varchar',
    character: 'char',
};
export const typeKey = (name: string): string => {
    const k = key(name);
    return TYPE_ALIASES[k] ?? k;
};

// PRIMARY KEY подразумевает UNIQUE, импорт расставляет оба флага
const isUnique = (f: DBField): boolean => Boolean(f.unique || f.primaryKey);

const describeFieldChanges = (a: DBField, b: DBField): string[] => {
    const changes: string[] = [];
    if (typeKey(a.type.name) !== typeKey(b.type.name)) {
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
    if (isUnique(a) !== isUnique(b)) {
        changes.push(isUnique(a) ? 'снят UNIQUE' : 'добавлен UNIQUE');
    }
    if ((a.default ?? '') !== (b.default ?? '')) {
        changes.push(`по умолчанию: ${a.default || '—'} → ${b.default || '—'}`);
    }
    const precisionA = `${a.precision ?? ''}/${a.scale ?? ''}`;
    const precisionB = `${b.precision ?? ''}/${b.scale ?? ''}`;
    if (precisionA !== precisionB) {
        changes.push(
            `точность: ${precisionA.replace(/^\/$/, '—')} → ${precisionB.replace(/^\/$/, '—')}`
        );
    }
    if (Boolean(a.increment) !== Boolean(b.increment)) {
        changes.push(
            a.increment ? 'снят AUTO_INCREMENT' : 'добавлен AUTO_INCREMENT'
        );
    }
    if (Boolean(a.isArray) !== Boolean(b.isArray)) {
        changes.push(a.isArray ? 'не массив' : 'массив');
    }
    if ((a.check ?? '') !== (b.check ?? '')) {
        changes.push(`CHECK: ${a.check || '—'} → ${b.check || '—'}`);
    }
    if ((a.collation ?? '') !== (b.collation ?? '')) {
        changes.push(
            `collation: ${a.collation || '—'} → ${b.collation || '—'}`
        );
    }
    if ((a.comments ?? '') !== (b.comments ?? '')) {
        changes.push('изменён комментарий');
    }
    return changes;
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

    const withoutPkIndex = (t: DBTable) =>
        t.indexes.filter((i) => !isPkIndex(t.fields, i));
    const beforeIdx = new Map(
        withoutPkIndex(before).map((i) => [
            indexSignature(before.fields, i.fieldIds, i.unique),
            i,
        ])
    );
    const afterIdx = new Map(
        withoutPkIndex(after).map((i) => [
            indexSignature(after.fields, i.fieldIds, i.unique),
            i,
        ])
    );
    const addedIndexes = [...afterIdx]
        .filter(([s]) => !beforeIdx.has(s))
        .map(([, i]) => i.name);
    const removedIndexes = [...beforeIdx]
        .filter(([s]) => !afterIdx.has(s))
        .map(([, i]) => i.name);
    const renamedIndexes = [...afterIdx]
        .filter(
            ([s, i]) => beforeIdx.has(s) && beforeIdx.get(s)!.name !== i.name
        )
        .map(([s, i]) => `индекс ${beforeIdx.get(s)!.name} → ${i.name}`);

    const otherChanges: string[] = [...renamedIndexes];
    if ((before.comments ?? '') !== (after.comments ?? '')) {
        otherChanges.push('изменён комментарий таблицы');
    }
    const norm = (e: string): string => e.replace(/\s+/g, ' ').trim();
    const beforeChecks = new Set(
        (before.checkConstraints ?? []).map((c) => norm(c.expression))
    );
    const afterChecks = new Set(
        (after.checkConstraints ?? []).map((c) => norm(c.expression))
    );
    for (const e of afterChecks) {
        if (!beforeChecks.has(e)) otherChanges.push(`+ CHECK (${e})`);
    }
    for (const e of beforeChecks) {
        if (!afterChecks.has(e)) otherChanges.push(`− CHECK (${e})`);
    }

    return {
        name: after.name,
        status: 'changed',
        fieldCount: after.fields.length,
        addedFields,
        removedFields,
        changedFields,
        addedIndexes,
        removedIndexes,
        otherChanges,
    };
};

// Представления и связи m:n в экспорт для модели не попадают, поэтому в сравнении не участвуют
const comparableTables = (diagram: Diagram): DBTable[] =>
    (diagram.tables ?? []).filter((t) => !t.isView);

const relationshipLabels = (diagram: Diagram): Map<string, string> => {
    const tables = diagram.tables ?? [];
    const result = new Map<string, string>();
    for (const r of diagram.relationships ?? []) {
        if (r.sourceCardinality === 'many' && r.targetCardinality === 'many')
            continue;
        const source = tables.find((t) => t.id === r.sourceTableId);
        const target = tables.find((t) => t.id === r.targetTableId);
        const sourceField = source?.fields.find(
            (f) => f.id === r.sourceFieldId
        );
        const targetField = target?.fields.find(
            (f) => f.id === r.targetFieldId
        );
        if (!source || !target || !sourceField || !targetField) continue;
        if (source.isView || target.isView) continue;
        const label = `${source.name}.${sourceField.name} → ${target.name}.${targetField.name}`;
        // направление не важно: импорт строит FK от родителя к потомку, схема могла хранить наоборот
        const ends = [
            `${source.name}.${sourceField.name}`,
            `${target.name}.${targetField.name}`,
        ]
            .map(key)
            .sort();
        result.set(ends.join('|'), label);
    }
    return result;
};

const emptyDetails = {
    addedFields: [],
    removedFields: [],
    changedFields: [],
    addedIndexes: [],
    removedIndexes: [],
    otherChanges: [],
};

const customTypeKey = (t: DBCustomType): string =>
    `${key(t.schema ?? '')}.${key(t.name)}`;
const customTypeBody = (t: DBCustomType): string =>
    JSON.stringify([t.kind, t.values ?? [], t.fields ?? []]);

export function diffDiagrams(before: Diagram, after: Diagram): DiagramDiff {
    const beforeList = comparableTables(before);
    const afterList = comparableTables(after);
    const all = [...beforeList, ...afterList];
    const afterToBefore = matchTables(afterList, beforeList, { byId: true });
    const matchedBefore = new Set([...afterToBefore.values()].map((t) => t.id));

    const tables: TableDiff[] = [];
    for (const t of afterList) {
        const old = afterToBefore.get(t.id);
        if (!old) {
            tables.push({
                ...emptyDetails,
                name: tableLabel(t, all),
                status: 'added',
                fieldCount: t.fields.length,
            });
            continue;
        }
        const d = diffTable(old, t);
        if (
            d.addedFields.length ||
            d.removedFields.length ||
            d.changedFields.length ||
            d.addedIndexes.length ||
            d.removedIndexes.length ||
            d.otherChanges.length
        ) {
            tables.push({ ...d, name: tableLabel(t, all) });
        }
    }
    for (const t of beforeList) {
        if (!matchedBefore.has(t.id)) {
            tables.push({
                ...emptyDetails,
                name: tableLabel(t, all),
                status: 'removed',
                fieldCount: t.fields.length,
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

    const beforeTypes = new Map(
        (before.customTypes ?? []).map((t) => [customTypeKey(t), t])
    );
    const addedTypes: string[] = [];
    const changedTypes: string[] = [];
    for (const t of after.customTypes ?? []) {
        const old = beforeTypes.get(customTypeKey(t));
        if (!old) addedTypes.push(t.name);
        else if (customTypeBody(old) !== customTypeBody(t))
            changedTypes.push(t.name);
    }

    return {
        tables,
        addedRelationships,
        removedRelationships,
        addedTypes,
        changedTypes,
        isEmpty:
            tables.length === 0 &&
            addedRelationships.length === 0 &&
            removedRelationships.length === 0 &&
            addedTypes.length === 0 &&
            changedTypes.length === 0,
    };
}
