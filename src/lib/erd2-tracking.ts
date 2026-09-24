import type { Diagram } from '@/lib/domain/diagram';

export interface Counts {
    tables: number;
    relations: number;
}

export type ActionType = 'table_add' | 'relation_add' | 'import';

const SOURCE_KEY = 'erd2_source';

// Один тик изменения: +1 таблица — обычное добавление, +2 и больше за раз — импорт схемы
// (DDL/DBML/шаблон/вставка), рост числа связей — добавление связи.
export function diffActions(prev: Counts, next: Counts): ActionType[] {
    const actions: ActionType[] = [];
    const addedTables = next.tables - prev.tables;
    if (addedTables >= 2) {
        actions.push('import');
    } else if (addedTables === 1) {
        actions.push('table_add');
    }
    if (next.relations > prev.relations && !actions.includes('import')) {
        actions.push('relation_add');
    }
    return actions;
}

// Только числа: названия таблиц и полей в аналитику не попадают.
export function buildSnapshotPayload(diagram: Diagram, isCloud: boolean) {
    const tables = diagram.tables ?? [];
    return {
        tables: tables.length,
        relations: diagram.relationships?.length ?? 0,
        fields: tables.reduce((sum, table) => sum + table.fields.length, 0),
        db_type: String(diagram.databaseType),
        is_cloud: isCloud,
    };
}

export function markTemplateSource(): void {
    try {
        sessionStorage.setItem(SOURCE_KEY, 'template');
    } catch {
        // ignore
    }
}

export function readStoredSource(): string | null {
    try {
        return sessionStorage.getItem(SOURCE_KEY);
    } catch {
        return null;
    }
}

export function resolveSource(
    referrer: string,
    stored: string | null
): 'template' | 'landing' | 'direct' {
    if (stored === 'template') {
        return 'template';
    }
    try {
        const path = new URL(referrer).pathname.replace(/\/+$/, '');
        if (path === '/tools/erd2' || path === '/tools/erd2/about') {
            return 'landing';
        }
    } catch {
        // пустой или некорректный referrer
    }
    return 'direct';
}
