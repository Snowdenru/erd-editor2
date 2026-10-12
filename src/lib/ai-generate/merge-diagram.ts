import type { Diagram } from '@/lib/domain/diagram';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { MIN_TABLE_SIZE, type DBTable } from '@/lib/domain/db-table';
import { rebaseProposal } from './rebase-proposal';

export const NEW_TABLE_GAP = 80;
export const NEW_TABLE_ROW_STEP = 360;
export const NEW_TABLE_ROWS = 4;

const relKey = (r: DBRelationship): string =>
    `${r.sourceTableId}|${r.sourceFieldId}|${r.targetTableId}|${r.targetFieldId}`;

// Применяет к текущей схеме то, что ИИ изменил: baseline — импорт того самого DDL, который мы ему отправили.
// Совпавшие таблицы остаются текущими (id, положение, оформление, всё, что импорт не читает),
// новые ставятся правее существующих.
export function mergeAiDiagram(
    current: Diagram,
    proposed: Diagram,
    baseline: Diagram
): Diagram {
    const currentTables = current.tables ?? [];
    const rebased = rebaseProposal(current, baseline, proposed);

    const right = currentTables.reduce(
        (max, t) => Math.max(max, t.x + (t.width ?? MIN_TABLE_SIZE)),
        0
    );
    const top = currentTables.length
        ? Math.min(...currentTables.map((t) => t.y))
        : 0;

    // exportBaseSQL не отдаёт модели представления, поэтому в ответе их нет: остаются как были
    const views = currentTables.filter((t) => t.isView);
    const viewIds = new Set(views.map((t) => t.id));
    const viewNames = new Set(views.map((t) => t.name.trim().toLowerCase()));
    const currentIds = new Set(currentTables.map((t) => t.id));
    const currentIndex = new Map(currentTables.map((t, i) => [t.id, i]));

    let newCount = 0;
    const kept: DBTable[] = [];
    const added: DBTable[] = [];
    for (const t of rebased.tables) {
        if (currentIds.has(t.id)) {
            kept.push(t);
            continue;
        }
        // ИИ не должен дублировать представление таблицей с тем же именем
        if (viewNames.has(t.name.trim().toLowerCase())) continue;
        const column = Math.floor(newCount / NEW_TABLE_ROWS);
        const row = newCount % NEW_TABLE_ROWS;
        newCount += 1;
        added.push({
            ...t,
            x:
                right +
                NEW_TABLE_GAP +
                column * (MIN_TABLE_SIZE + NEW_TABLE_GAP),
            y: top + row * NEW_TABLE_ROW_STEP,
        });
    }
    kept.sort(
        (a, b) =>
            (currentIndex.get(a.id) ?? Infinity) -
            (currentIndex.get(b.id) ?? Infinity)
    );
    const tables = [...kept, ...added, ...views];

    const fieldIdsByTable = new Map(
        tables.map((t) => [t.id, new Set(t.fields.map((f) => f.id))])
    );
    const relationships: DBRelationship[] = [];
    const produced = new Set<string>();
    const push = (r: DBRelationship) => {
        if (
            !fieldIdsByTable.get(r.sourceTableId)?.has(r.sourceFieldId) ||
            !fieldIdsByTable.get(r.targetTableId)?.has(r.targetFieldId)
        )
            return;
        if (produced.has(relKey(r))) return;
        produced.add(relKey(r));
        relationships.push(r);
    };
    rebased.relationships.forEach(push);
    // Связи с представлениями и m:n экспортёр тоже не передаёт: переносим их из текущей схемы
    for (const r of current.relationships ?? []) {
        const touchesView =
            viewIds.has(r.sourceTableId) || viewIds.has(r.targetTableId);
        const manyToMany =
            r.sourceCardinality === 'many' && r.targetCardinality === 'many';
        if (touchesView || manyToMany) push(r);
    }

    const tableIds = new Set(tables.map((t) => t.id));
    const dependencies = current.dependencies?.filter(
        (d) => tableIds.has(d.tableId) && tableIds.has(d.dependentTableId)
    );

    return {
        ...current,
        tables,
        relationships,
        ...(rebased.customTypes ? { customTypes: rebased.customTypes } : {}),
        ...(dependencies ? { dependencies } : {}),
        updatedAt: new Date(),
    };
}
