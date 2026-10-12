import type { Diagram } from '@/lib/domain/diagram';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { DBField } from '@/lib/domain/db-field';
import type { DBIndex } from '@/lib/domain/db-index';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBTable } from '@/lib/domain/db-table';
import { typeKey } from './diagram-diff';
import { indexSignature, isPkIndex, key, matchTables } from './diagram-keys';

// Что в ответе ИИ осталось таким же, как в базовом импорте того, что мы ему отправили, ИИ не менял:
// расхождения с текущей схемой там — потери самого импорта (индексы, комментарии, длины, PK у enum…).
// Поэтому к текущей схеме применяется только разница «базовый импорт → ответ».
export interface RebasedProposal {
    tables: DBTable[];
    relationships: DBRelationship[];
    customTypes?: DBCustomType[];
}

const FIELD_ATTRS = [
    'characterMaximumLength',
    'precision',
    'scale',
    'nullable',
    'primaryKey',
    'unique',
    'default',
    'increment',
    'isArray',
    'comments',
    'check',
    'collation',
] as const satisfies readonly (keyof DBField)[];

const isEmpty = (v: unknown): boolean =>
    v === undefined || v === null || v === '';
const same = (a: unknown, b: unknown): boolean =>
    (isEmpty(a) && isEmpty(b)) || a === b;

const rebaseField = (cur: DBField, base: DBField, prop: DBField): DBField => {
    const out: DBField = { ...cur };
    if (typeKey(base.type.name) !== typeKey(prop.type.name)) {
        out.type = prop.type;
    }
    for (const attr of FIELD_ATTRS) {
        if (same(base[attr], prop[attr])) continue;
        if (isEmpty(prop[attr])) delete out[attr];
        else (out as unknown as Record<string, unknown>)[attr] = prop[attr];
    }
    return out;
};

const normExpr = (e: string): string => e.replace(/\s+/g, ' ').trim();

const rebaseIndexes = (
    cur: DBTable,
    base: DBTable,
    prop: DBTable,
    fields: DBField[],
    fieldIdEff: Map<string, string>
): DBIndex[] => {
    const baseBySig = new Map(
        base.indexes.map((i) => [
            indexSignature(base.fields, i.fieldIds, i.unique),
            i,
        ])
    );
    const propBySig = new Map(
        prop.indexes.map((i) => [
            indexSignature(prop.fields, i.fieldIds, i.unique),
            i,
        ])
    );
    const fieldIds = new Set(fields.map((f) => f.id));
    const result: DBIndex[] = [];
    const seen = new Set<string>();
    for (const ix of cur.indexes) {
        if (!ix.fieldIds.every((id) => fieldIds.has(id))) continue;
        const sig = indexSignature(cur.fields, ix.fieldIds, ix.unique);
        const b = baseBySig.get(sig);
        const p = propBySig.get(sig);
        // индекса нет в базовом импорте — импорт его не читает; индекс был и пропал из ответа — ИИ его убрал
        if (b && !p && !isPkIndex(cur.fields, ix)) continue;
        result.push(b && p && b.name !== p.name ? { ...ix, name: p.name } : ix);
        seen.add(sig);
    }
    for (const [sig, ix] of propBySig) {
        if (baseBySig.has(sig) || seen.has(sig)) continue;
        if (isPkIndex(prop.fields, ix)) continue;
        const ids = ix.fieldIds.map((id) => fieldIdEff.get(id));
        if (!ids.every((id): id is string => Boolean(id) && fieldIds.has(id!)))
            continue;
        result.push({ ...ix, fieldIds: ids as string[] });
    }
    return result;
};

const rebaseTable = (
    cur: DBTable,
    base: DBTable,
    prop: DBTable,
    fieldIdEff: Map<string, string>
): DBTable => {
    const baseFields = new Map(base.fields.map((f) => [key(f.name), f]));
    const propFields = new Map(prop.fields.map((f) => [key(f.name), f]));
    const fields: DBField[] = [];
    for (const cf of cur.fields) {
        const b = baseFields.get(key(cf.name));
        if (!b) {
            fields.push(cf); // импорт эту колонку не прочитал — ИИ её не видел
            continue;
        }
        const p = propFields.get(key(cf.name));
        if (!p) continue; // ИИ колонку убрал
        fieldIdEff.set(p.id, cf.id);
        fields.push(rebaseField(cf, b, p));
    }
    for (const p of prop.fields) {
        if (baseFields.has(key(p.name))) continue;
        fieldIdEff.set(p.id, p.id);
        fields.push(p);
    }

    const out: DBTable = { ...cur, fields };
    if (base.name !== prop.name) out.name = prop.name;
    if (!same(base.comments, prop.comments)) {
        if (isEmpty(prop.comments)) delete out.comments;
        else out.comments = prop.comments;
    }
    const baseChecks = new Set(
        (base.checkConstraints ?? []).map((c) => normExpr(c.expression))
    );
    const propChecks = new Set(
        (prop.checkConstraints ?? []).map((c) => normExpr(c.expression))
    );
    const checks = [
        ...(cur.checkConstraints ?? []).filter((c) => {
            const e = normExpr(c.expression);
            return !(baseChecks.has(e) && !propChecks.has(e));
        }),
        ...(prop.checkConstraints ?? []).filter(
            (c) => !baseChecks.has(normExpr(c.expression))
        ),
    ];
    const seenChecks = new Set<string>();
    const uniqueChecks = checks.filter((c) => {
        const e = normExpr(c.expression);
        if (seenChecks.has(e)) return false;
        seenChecks.add(e);
        return true;
    });
    if (uniqueChecks.length) out.checkConstraints = uniqueChecks;
    else delete out.checkConstraints;

    out.indexes = rebaseIndexes(cur, base, prop, fields, fieldIdEff);
    return out;
};

// Связь определяется концами, а не направлением: импорт строит FK от родителя к потомку
const relEnds = (diagram: Diagram, r: DBRelationship): string | null => {
    if (r.sourceCardinality === 'many' && r.targetCardinality === 'many')
        return null;
    const tables = diagram.tables ?? [];
    const source = tables.find((t) => t.id === r.sourceTableId);
    const target = tables.find((t) => t.id === r.targetTableId);
    const sf = source?.fields.find((f) => f.id === r.sourceFieldId);
    const tf = target?.fields.find((f) => f.id === r.targetFieldId);
    if (!source || !target || !sf || !tf || source.isView || target.isView)
        return null;
    return [`${source.name}.${sf.name}`, `${target.name}.${tf.name}`]
        .map(key)
        .sort()
        .join('|');
};

const customTypeKey = (t: DBCustomType): string =>
    `${key(t.schema ?? '')}.${key(t.name)}`;
const customTypeBody = (t: DBCustomType): string =>
    JSON.stringify([t.kind, t.values ?? [], t.fields ?? []]);

const rebaseCustomTypes = (
    current: Diagram,
    baseline: Diagram,
    proposed: Diagram
): DBCustomType[] | undefined => {
    const base = new Map(
        (baseline.customTypes ?? []).map((t) => [customTypeKey(t), t])
    );
    const result = [...(current.customTypes ?? [])];
    for (const pt of proposed.customTypes ?? []) {
        const k = customTypeKey(pt);
        const b = base.get(k);
        const idx = result.findIndex((t) => customTypeKey(t) === k);
        if (!b) {
            if (idx === -1) result.push(pt);
            continue;
        }
        if (idx !== -1 && customTypeBody(b) !== customTypeBody(pt)) {
            result[idx] = {
                ...result[idx],
                kind: pt.kind,
                values: pt.values,
                fields: pt.fields,
            };
        }
    }
    return result.length || current.customTypes ? result : undefined;
};

export function rebaseProposal(
    current: Diagram,
    baseline: Diagram,
    proposed: Diagram
): RebasedProposal {
    const curTables = (current.tables ?? []).filter((t) => !t.isView);
    const baseTables = baseline.tables ?? [];
    const propTables = proposed.tables ?? [];

    const baseToCur = matchTables(baseTables, curTables);
    const propToBase = matchTables(propTables, baseTables);
    const curToBase = new Map<string, DBTable>();
    for (const b of baseTables) {
        const c = baseToCur.get(b.id);
        if (c) curToBase.set(c.id, b);
    }
    const baseToProp = new Map<string, DBTable>();
    for (const p of propTables) {
        const b = propToBase.get(p.id);
        if (b) baseToProp.set(b.id, p);
    }

    const tableIdEff = new Map<string, string>();
    const fieldIdEff = new Map<string, string>();
    const tables: DBTable[] = [];
    for (const c of curTables) {
        const b = curToBase.get(c.id);
        if (!b) {
            tables.push(c); // импорт таблицу не прочитал — ИИ её не видел
            continue;
        }
        const p = baseToProp.get(b.id);
        if (!p) continue; // ИИ таблицу убрал
        tableIdEff.set(p.id, c.id);
        tables.push(rebaseTable(c, b, p, fieldIdEff));
    }
    for (const p of propTables) {
        const b = propToBase.get(p.id);
        if (b && baseToCur.has(b.id)) continue;
        tableIdEff.set(p.id, p.id);
        for (const f of p.fields) fieldIdEff.set(f.id, f.id);
        tables.push(p);
    }

    const tableIds = new Set(tables.map((t) => t.id));
    const fieldIdsByTable = new Map(
        tables.map((t) => [t.id, new Set(t.fields.map((f) => f.id))])
    );
    const baseEnds = new Set(
        (baseline.relationships ?? [])
            .map((r) => relEnds(baseline, r))
            .filter((e): e is string => e !== null)
    );
    const propEnds = new Set(
        (proposed.relationships ?? [])
            .map((r) => relEnds(proposed, r))
            .filter((e): e is string => e !== null)
    );
    const relationships: DBRelationship[] = [];
    const seenEnds = new Set<string>();
    for (const r of current.relationships ?? []) {
        const ends = relEnds(current, r);
        if (ends === null) continue; // представления и m:n переносит слияние
        if (baseEnds.has(ends) && !propEnds.has(ends)) continue; // ИИ связь убрал
        if (
            !fieldIdsByTable.get(r.sourceTableId)?.has(r.sourceFieldId) ||
            !fieldIdsByTable.get(r.targetTableId)?.has(r.targetFieldId)
        )
            continue;
        seenEnds.add(ends);
        relationships.push(r);
    }
    for (const r of proposed.relationships ?? []) {
        const ends = relEnds(proposed, r);
        if (ends === null || baseEnds.has(ends) || seenEnds.has(ends)) continue;
        const sourceTableId = tableIdEff.get(r.sourceTableId);
        const targetTableId = tableIdEff.get(r.targetTableId);
        const sourceFieldId = fieldIdEff.get(r.sourceFieldId);
        const targetFieldId = fieldIdEff.get(r.targetFieldId);
        if (
            !sourceTableId ||
            !targetTableId ||
            !sourceFieldId ||
            !targetFieldId ||
            !tableIds.has(sourceTableId) ||
            !tableIds.has(targetTableId)
        )
            continue;
        seenEnds.add(ends);
        relationships.push({
            ...r,
            sourceTableId,
            targetTableId,
            sourceFieldId,
            targetFieldId,
        });
    }

    const customTypes = rebaseCustomTypes(current, baseline, proposed);
    return { tables, relationships, ...(customTypes ? { customTypes } : {}) };
}
