import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { MIN_TABLE_SIZE, type DBTable } from '@/lib/domain/db-table';

const key = (name: string): string => name.trim().toLowerCase();

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
            return match
                ? {
                      ...pf,
                      id: match.id,
                      createdAt: match.createdAt,
                      comments: pf.comments ?? match.comments,
                  }
                : pf;
        });
        const indexes = p.indexes.map((ix) => ({
            ...ix,
            fieldIds: ix.fieldIds.map((id) => fieldIdMap.get(id) ?? id),
        }));

        if (old) {
            return {
                ...p,
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
                comments: p.comments ?? old.comments,
                fields,
                indexes,
            };
        }
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

    const tables = [...mergedFromProposal, ...views];

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
        relationships.push(currentRels.get(relKey(mapped)) ?? mapped);
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
