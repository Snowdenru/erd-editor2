import { APP_BASE } from '@/lib/app-config';
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

const ENTRY_REDIRECT_KEY = 'erd2_entry_redirect';
let entryRedirectCache: boolean | null = null;

// Флаг ставит скрипт erd2-entry (index.html) перед location.replace: у документа после него
// referrer = <APP_BASE>/, хотя лендинг пользователь не видел. Читаем флаг один раз за загрузку
// страницы, удаляем из sessionStorage (чтобы он не влиял на следующие полные загрузки в этой
// вкладке) и кешируем в модуле — повторные вызовы за ту же загрузку получают то же значение.
export function consumeEntryRedirect(): boolean {
    if (entryRedirectCache !== null) {
        return entryRedirectCache;
    }
    let flag = false;
    try {
        flag = sessionStorage.getItem(ENTRY_REDIRECT_KEY) === '1';
        if (flag) {
            sessionStorage.removeItem(ENTRY_REDIRECT_KEY);
        }
    } catch {
        // sessionStorage недоступен
    }
    entryRedirectCache = flag;
    return flag;
}

export function resetEntryRedirectCache(): void {
    entryRedirectCache = null;
}

export function resolveSource(
    referrer: string,
    stored: string | null,
    entryRedirect = false
): 'template' | 'landing' | 'direct' {
    if (stored === 'template') {
        return 'template';
    }
    if (entryRedirect) {
        return 'direct';
    }
    try {
        const path = new URL(referrer).pathname.replace(/\/+$/, '');
        if (path === APP_BASE || path === `${APP_BASE}/about`) {
            return 'landing';
        }
    } catch {
        // пустой или некорректный referrer
    }
    return 'direct';
}
