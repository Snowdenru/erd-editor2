import type { DBField } from '@/lib/domain/db-field';
import type { DBIndex } from '@/lib/domain/db-index';
import type { DBTable } from '@/lib/domain/db-table';

export const key = (name: string): string => name.trim().toLowerCase();

// Таблица определяется схемой и именем: public.users и auth.users — разные таблицы
export const tableKey = (t: DBTable): string =>
    `${key(t.schema ?? '')}.${key(t.name)}`;

// Сопоставляет таблицы «from» с таблицами «to» один к одному: from.id -> таблица из «to».
// Сначала точное совпадение (опционально по id), затем схема+имя, затем одно только имя —
// лишь когда оно однозначно с обеих сторон (импорт мог подставить схему по умолчанию).
export function matchTables(
    from: DBTable[],
    to: DBTable[],
    options: { byId?: boolean } = {}
): Map<string, DBTable> {
    const result = new Map<string, DBTable>();
    const claimed = new Set<string>();
    const claim = (f: DBTable, t: DBTable) => {
        result.set(f.id, t);
        claimed.add(t.id);
    };

    if (options.byId) {
        const toById = new Map(to.map((t) => [t.id, t]));
        for (const f of from) {
            const t = toById.get(f.id);
            if (t && !claimed.has(t.id)) claim(f, t);
        }
    }

    for (const f of from) {
        if (result.has(f.id)) continue;
        const t = to.find(
            (c) => !claimed.has(c.id) && tableKey(c) === tableKey(f)
        );
        if (t) claim(f, t);
    }

    const byName = <T extends DBTable>(list: T[]): Map<string, T[]> => {
        const m = new Map<string, T[]>();
        for (const t of list) {
            const k = key(t.name);
            m.set(k, [...(m.get(k) ?? []), t]);
        }
        return m;
    };
    const restFrom = byName(from.filter((f) => !result.has(f.id)));
    const restTo = byName(to.filter((t) => !claimed.has(t.id)));
    for (const [k, fs] of restFrom) {
        const ts = restTo.get(k);
        if (fs.length === 1 && ts?.length === 1) claim(fs[0], ts[0]);
    }
    return result;
}

// Индекс определяется набором колонок и уникальностью, а не именем: модель часто лишь переименовывает индекс
export const indexSignature = (
    fields: DBField[],
    fieldIds: string[],
    unique: boolean
): string => {
    const names = fieldIds
        .map((id) => fields.find((f) => f.id === id)?.name ?? id)
        .map(key)
        .sort();
    return `${unique ? 'u' : 'n'}:${names.join(',')}`;
};

// Импорт добавляет безымянный уникальный индекс по PRIMARY KEY: это та же сущность, что и сам ключ
export const isPkIndex = (fields: DBField[], ix: DBIndex): boolean => {
    const pk = fields
        .filter((f) => f.primaryKey)
        .map((f) => f.id)
        .sort()
        .join(',');
    return Boolean(ix.unique && pk && [...ix.fieldIds].sort().join(',') === pk);
};

// Метка для списков: с именем схемы, когда имя таблицы не уникально
export const tableLabel = (t: DBTable, all: DBTable[]): string =>
    t.schema && all.some((o) => o !== t && key(o.name) === key(t.name))
        ? `${t.schema}.${t.name}`
        : t.name;
