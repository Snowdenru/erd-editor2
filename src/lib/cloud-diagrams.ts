import { diagramSchema, type Diagram } from '@/lib/domain/diagram';

export interface CloudDiagramRow {
    id: string;
    title: string;
    updated_at: string;
    created_at?: string;
    // У закрытой строки (locked) content нет — сервер его не отдаёт.
    content?: unknown;
    locked?: boolean;
    tables?: number;
    db_type?: string | null;
}

export interface LockedCard {
    id: string;
    title: string;
    tables: number;
    dbType: string | null;
    savedAt: Date;
}

export function splitRows(rows: CloudDiagramRow[]): {
    open: CloudDiagramRow[];
    locked: LockedCard[];
} {
    const open: CloudDiagramRow[] = [];
    const locked: LockedCard[] = [];
    for (const row of rows) {
        if (!row.locked) {
            open.push(row);
            continue;
        }
        locked.push({
            id: row.id,
            title: row.title,
            tables: row.tables ?? 0,
            dbType: row.db_type ?? null,
            savedAt: new Date(row.updated_at),
        });
    }
    return { open, locked };
}

const parseDate = (value: unknown): Date | null =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? new Date(value)
        : null;

// Содержимое схемы на сервере — JSON currentDiagram: даты пришли строками, возвращаем Date.
// Название берём из title строки. updatedAt — из содержимого (та же метка, что у локальной схемы):
// серверное updated_at всегда позже локального, сравнивать с ним нельзя.
export function reviveDiagram(row: CloudDiagramRow): Diagram | null {
    if (!row.content || typeof row.content !== 'object') return null;
    const content = row.content as Record<string, unknown>;
    const updatedAt = parseDate(content.updatedAt) ?? new Date(row.updated_at);
    const createdAt = parseDate(content.createdAt) ?? updatedAt;

    const parsed = diagramSchema.safeParse({
        ...content,
        id: row.id,
        name: row.title,
        createdAt,
        updatedAt,
    });
    return parsed.success ? parsed.data : null;
}

export type PullAction =
    | { kind: 'add'; diagram: Diagram }
    | { kind: 'replace'; diagram: Diagram; backupOf: Diagram };

// Побеждает более свежая updatedAt. Локальная, которая новее или равна облачной, не трогается —
// её отправит SqllabSyncProvider. Более старая локальная заменяется облачной, но не теряется.
export function planPull(cloud: Diagram[], local: Diagram[]): PullAction[] {
    const localById = new Map(local.map((d) => [d.id, d]));
    const actions: PullAction[] = [];
    for (const diagram of cloud) {
        const existing = localById.get(diagram.id);
        if (!existing) {
            actions.push({ kind: 'add', diagram });
        } else if (existing.updatedAt.getTime() < diagram.updatedAt.getTime()) {
            actions.push({ kind: 'replace', diagram, backupOf: existing });
        }
    }
    return actions;
}
