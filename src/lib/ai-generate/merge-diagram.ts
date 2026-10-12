import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { MIN_TABLE_SIZE, type DBTable } from '@/lib/domain/db-table';
import type { DBIndex } from '@/lib/domain/db-index';
import { typeKey } from './diagram-diff';

const key = (name: string): string => name.trim().toLowerCase();

const isEmptyValue = (v: unknown): boolean =>
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0);

// Копия объекта без ключей со значением undefined / null / ''
const definedOnly = <T extends object>(obj: T): Partial<T> =>
    Object.fromEntries(
        Object.entries(obj).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
        )
    ) as Partial<T>;

// Текущее поле — основа: поверх кладём только то, что предложение действительно сообщает.
// Импорт не читает часть атрибутов (длины, комментарии, default…), и их отсутствие не значит «убрано».
const mergeField = (old: DBField, pf: DBField): DBField => {
    const typeChanged = typeKey(old.type.name) !== typeKey(pf.type.name);
    const { increment: pfIncrement, ...overlay } = definedOnly(pf);
    const merged: DBField = {
        ...old,
        ...overlay,
        id: old.id,
        createdAt: old.createdAt,
        nullable: pf.nullable,
        primaryKey: pf.primaryKey,
        // PRIMARY KEY подразумевает UNIQUE, импорт ставит оба флага: у ключа флаг unique не трогаем
        unique: pf.primaryKey && old.primaryKey ? old.unique : pf.unique,
        type: typeChanged ? pf.type : old.type,
        comments: isEmptyValue(pf.comments) ? old.comments : pf.comments,
        check: isEmptyValue(pf.check) ? old.check : pf.check,
        collation: isEmptyValue(pf.collation) ? old.collation : pf.collation,
    };
    // «false» из импорта при неизвестном старом значении ничего не сообщает
    if (pfIncrement || (old.increment !== undefined && pfIncrement != null))
        merged.increment = pfIncrement;
    if (typeChanged) {
        // тип сменили всерьёз: длина/точность старого типа к новому не относятся
        merged.characterMaximumLength = pf.characterMaximumLength;
        merged.precision = pf.precision;
        merged.scale = pf.scale;
    }
    // не плодим ключи со значением undefined
    for (const k of Object.keys(merged) as (keyof DBField)[]) {
        if (merged[k] === undefined) delete merged[k];
    }
    return merged;
};

// CHECK-ограничения: пустой ответ ничего не значит; те же выражения — остаются старые объекты (с id)
const mergeChecks = (
    old: DBTable['checkConstraints'],
    proposed: DBTable['checkConstraints']
): DBTable['checkConstraints'] => {
    if (!proposed || proposed.length === 0) return old;
    const norm = (e: string): string => e.replace(/\s+/g, ' ').trim();
    const oldByExpr = new Map((old ?? []).map((c) => [norm(c.expression), c]));
    return proposed.map((c) => oldByExpr.get(norm(c.expression)) ?? c);
};

export const NEW_TABLE_GAP = 80;
export const NEW_TABLE_ROW_STEP = 360;
export const NEW_TABLE_ROWS = 4;

// Сливает предложенную ИИ схему в текущую «на месте»: совпавшие по имени таблицы и поля
// сохраняют id, положение и оформление, новые таблицы ставятся правее существующих.
export function mergeAiDiagram(current: Diagram, proposed: Diagram): Diagram {
    const currentTables = current.tables ?? [];
    const currentByName = new Map(currentTables.map((t) => [key(t.name), t]));
    const tableIdMap = new Map<string, string>();
    const fieldIdMap = new Map<string, string>();
    const claimedTables = new Set<string>();

    const right = currentTables.reduce(
        (max, t) => Math.max(max, t.x + (t.width ?? MIN_TABLE_SIZE)),
        0
    );
    const top = currentTables.length
        ? Math.min(...currentTables.map((t) => t.y))
        : 0;
    let newCount = 0;

    // exportBaseSQL не отдаёт модели представления, поэтому в ответе их нет: остаются как были
    const views = currentTables.filter((t) => t.isView);
    const viewNames = new Set(views.map((t) => key(t.name)));
    const viewIds = new Set(views.map((t) => t.id));

    const proposedTables = (proposed.tables ?? []).filter(
        (p) => !viewNames.has(key(p.name))
    );
    const mergedFromProposal = proposedTables.map((p): DBTable => {
        const candidate = currentByName.get(key(p.name));
        // второй дубль по имени не получает id уже занятой текущей таблицы
        const old =
            candidate && !claimedTables.has(candidate.id)
                ? candidate
                : undefined;
        if (old) claimedTables.add(old.id);
        tableIdMap.set(p.id, old ? old.id : p.id);

        const oldFields = new Map(
            (old?.fields ?? []).map((f) => [key(f.name), f])
        );
        const claimedFields = new Set<string>();
        const fields = p.fields.map((pf): DBField => {
            const candidateField = oldFields.get(key(pf.name));
            const match =
                candidateField && !claimedFields.has(candidateField.id)
                    ? candidateField
                    : undefined;
            if (match) claimedFields.add(match.id);
            fieldIdMap.set(pf.id, match ? match.id : pf.id);
            return match ? mergeField(match, pf) : pf;
        });
        const remap = (ids: string[]): string[] =>
            ids.map((id) => fieldIdMap.get(id) ?? id);

        if (old) {
            const fieldIds = new Set(fields.map((f) => f.id));
            const nameById = new Map(fields.map((f) => [f.id, key(f.name)]));
            const signature = (ids: string[], unique: boolean): string =>
                `${unique ? 'u' : 'n'}:${ids
                    .map((id) => nameById.get(id) ?? id)
                    .sort()
                    .join(',')}`;
            // индексы текущей схемы не теряются: матч полей сохранил их id
            const indexes: DBIndex[] = old.indexes.filter((ix) =>
                ix.fieldIds.every((id) => fieldIds.has(id))
            );
            const seen = new Set(
                indexes.map((ix) => signature(ix.fieldIds, ix.unique))
            );
            const pkSet = fields
                .filter((f) => f.primaryKey)
                .map((f) => f.id)
                .sort()
                .join(',');
            for (const ix of p.indexes) {
                const ids = remap(ix.fieldIds);
                if (!ids.every((id) => fieldIds.has(id))) continue;
                // безымянный уникальный индекс по PRIMARY KEY добавляет сам импорт
                if (ix.unique && pkSet && [...ids].sort().join(',') === pkSet)
                    continue;
                const sig = signature(ids, ix.unique);
                if (seen.has(sig)) continue;
                seen.add(sig);
                indexes.push({ ...ix, fieldIds: ids });
            }
            const result: DBTable = {
                ...old,
                ...definedOnly(p),
                id: old.id,
                x: old.x,
                y: old.y,
                color: old.color,
                width: old.width,
                order: old.order,
                expanded: old.expanded,
                parentAreaId: old.parentAreaId,
                schema: old.schema,
                createdAt: old.createdAt,
                comments: isEmptyValue(p.comments) ? old.comments : p.comments,
                checkConstraints: mergeChecks(
                    old.checkConstraints,
                    p.checkConstraints
                ),
                fields,
                indexes,
            };
            for (const k of Object.keys(result) as (keyof DBTable)[]) {
                if (result[k] === undefined) delete result[k];
            }
            return result;
        }
        const indexes = p.indexes.map((ix) => ({
            ...ix,
            fieldIds: remap(ix.fieldIds),
        }));
        const column = Math.floor(newCount / NEW_TABLE_ROWS);
        const row = newCount % NEW_TABLE_ROWS;
        newCount += 1;
        return {
            ...p,
            x:
                right +
                NEW_TABLE_GAP +
                column * (MIN_TABLE_SIZE + NEW_TABLE_GAP),
            y: top + row * NEW_TABLE_ROW_STEP,
            fields,
            indexes,
        };
    });

    // совпавшие таблицы остаются в порядке текущей схемы, новые идут следом
    const currentIndex = new Map(currentTables.map((t, i) => [t.id, i]));
    const ordered = mergedFromProposal
        .map((t, i) => ({ t, i }))
        .sort(
            (a, b) =>
                (currentIndex.get(a.t.id) ?? Infinity) -
                    (currentIndex.get(b.t.id) ?? Infinity) || a.i - b.i
        )
        .map(({ t }) => t);
    const tables = [...ordered, ...views];

    const relKey = (r: DBRelationship): string =>
        `${r.sourceTableId}|${r.sourceFieldId}|${r.targetTableId}|${r.targetFieldId}`;
    const currentRels = new Map(
        (current.relationships ?? []).map((r) => [relKey(r), r])
    );
    const relationships: DBRelationship[] = [];
    for (const r of proposed.relationships ?? []) {
        const sourceTableId = tableIdMap.get(r.sourceTableId);
        const targetTableId = tableIdMap.get(r.targetTableId);
        const sourceFieldId = fieldIdMap.get(r.sourceFieldId);
        const targetFieldId = fieldIdMap.get(r.targetFieldId);
        if (
            !sourceTableId ||
            !targetTableId ||
            !sourceFieldId ||
            !targetFieldId
        )
            continue;
        const mapped = {
            ...r,
            sourceTableId,
            targetTableId,
            sourceFieldId,
            targetFieldId,
        };
        // импорт строит связь от родителя к потомку (1:1 экспортёр пишет наоборот): запись с теми же
        // концами и зеркальными кардинальностями — это старая связь, оставляем старый объект
        const reversed =
            mapped.sourceCardinality !== 'many' ||
            mapped.targetCardinality !== 'many'
                ? currentRels.get(
                      relKey({
                          ...mapped,
                          sourceTableId: targetTableId,
                          sourceFieldId: targetFieldId,
                          targetTableId: sourceTableId,
                          targetFieldId: sourceFieldId,
                      })
                  )
                : undefined;
        const existing =
            currentRels.get(relKey(mapped)) ??
            (reversed &&
            reversed.sourceCardinality === mapped.targetCardinality &&
            reversed.targetCardinality === mapped.sourceCardinality
                ? reversed
                : undefined);
        const chosen = existing ?? mapped;
        if (relationships.some((x) => relKey(x) === relKey(chosen))) continue;
        relationships.push(chosen);
    }

    // Связи с представлениями и m:n экспортёр тоже не передаёт: переносим их из текущей схемы,
    // если обе таблицы и оба поля ещё на месте
    const fieldIdsByTable = new Map(
        tables.map((t) => [t.id, new Set(t.fields.map((f) => f.id))])
    );
    const produced = new Set(relationships.map(relKey));
    for (const r of current.relationships ?? []) {
        const touchesView =
            viewIds.has(r.sourceTableId) || viewIds.has(r.targetTableId);
        const manyToMany =
            r.sourceCardinality === 'many' && r.targetCardinality === 'many';
        if (!touchesView && !manyToMany) continue;
        if (
            !fieldIdsByTable.get(r.sourceTableId)?.has(r.sourceFieldId) ||
            !fieldIdsByTable.get(r.targetTableId)?.has(r.targetFieldId)
        )
            continue;
        if (produced.has(relKey(r))) continue;
        produced.add(relKey(r));
        relationships.push(r);
    }

    const tableIds = new Set(tables.map((t) => t.id));
    const dependencies = current.dependencies?.filter(
        (d) => tableIds.has(d.tableId) && tableIds.has(d.dependentTableId)
    );

    return {
        ...current,
        tables,
        relationships,
        ...(dependencies ? { dependencies } : {}),
        updatedAt: new Date(),
    };
}
