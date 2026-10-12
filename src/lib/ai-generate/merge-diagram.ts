import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { MIN_TABLE_SIZE, type DBTable } from '@/lib/domain/db-table';

const key = (name: string): string => name.trim().toLowerCase();

const NEW_TABLE_GAP = 80;
const NEW_TABLE_ROW_STEP = 360;
const NEW_TABLE_ROWS = 4;

// Сливает предложенную ИИ схему в текущую «на месте»: совпавшие по имени таблицы и поля
// сохраняют id, положение и оформление, новые таблицы ставятся правее существующих.
export function mergeAiDiagram(current: Diagram, proposed: Diagram): Diagram {
    const currentTables = current.tables ?? [];
    const currentByName = new Map(currentTables.map((t) => [key(t.name), t]));
    const tableIdMap = new Map<string, string>();
    const fieldIdMap = new Map<string, string>();

    const right = currentTables.reduce(
        (max, t) => Math.max(max, t.x + (t.width ?? MIN_TABLE_SIZE)),
        0
    );
    const top = currentTables.length
        ? Math.min(...currentTables.map((t) => t.y))
        : 0;
    let newCount = 0;

    const tables = (proposed.tables ?? []).map((p): DBTable => {
        const old = currentByName.get(key(p.name));
        tableIdMap.set(p.id, old ? old.id : p.id);

        const oldFields = new Map(
            (old?.fields ?? []).map((f) => [key(f.name), f])
        );
        const fields = p.fields.map((pf): DBField => {
            const match = oldFields.get(key(pf.name));
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

    return { ...current, tables, relationships, updatedAt: new Date() };
}
