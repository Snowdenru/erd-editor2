import { authFetch } from '@/lib/sqllab-auth';

export const PUBLIC_THEMES = [
    'light',
    'dark',
    'palette-blue',
    'palette-green',
    'palette-violet',
] as const;

export type PublicTheme = (typeof PUBLIC_THEMES)[number];

export const THEME_LABELS: Record<PublicTheme, string> = {
    light: 'Светлая',
    dark: 'Тёмная',
    'palette-blue': 'Синяя',
    'palette-green': 'Зелёная',
    'palette-violet': 'Фиолетовая',
};

export const isPublicTheme = (value: unknown): value is PublicTheme =>
    typeof value === 'string' &&
    (PUBLIC_THEMES as readonly string[]).includes(value);

// Параметр ?theme= сильнее темы, выбранной владельцем; мусорные значения игнорируем.
export const resolveTheme = (
    param: string | null,
    saved: string | null
): PublicTheme => {
    if (isPublicTheme(param)) return param;
    if (isPublicTheme(saved)) return saved;
    return 'light';
};

export const themeMode = (theme: PublicTheme): 'light' | 'dark' =>
    theme === 'dark' ? 'dark' : 'light';

const PALETTES: Record<string, string[]> = {
    'palette-blue': ['#3b82f6', '#0ea5e9', '#6366f1', '#06b6d4', '#2563eb'],
    'palette-green': ['#22c55e', '#10b981', '#84cc16', '#14b8a6', '#16a34a'],
    'palette-violet': ['#8b5cf6', '#a855f7', '#d946ef', '#6366f1', '#7c3aed'],
};

// Перекрашиваем копии таблиц только для показа: данные схемы не меняются.
export function applyPalette<T extends { color: string }>(
    tables: T[],
    theme: PublicTheme
): T[] {
    const palette = PALETTES[theme];
    if (!palette) return tables;
    return tables.map((table, index) => ({
        ...table,
        color: palette[index % palette.length],
    }));
}

export interface PublicDiagram {
    id: string;
    title: string;
    content: Record<string, unknown>;
    database_type: string | null;
    public_theme: PublicTheme;
    updated_at: string;
    grace_until: string | null;
}

export type PublicFetchResult =
    | { ok: true; diagram: PublicDiagram }
    | { ok: false; code: 'not_found' | 'closed' | 'error' };

export async function fetchPublicDiagram(
    id: string
): Promise<PublicFetchResult> {
    try {
        const res = await fetch(`/api/erd2/public/${encodeURIComponent(id)}/`);
        if (res.ok) {
            return { ok: true, diagram: (await res.json()) as PublicDiagram };
        }
        if (res.status === 404) {
            const body = (await res.json().catch(() => ({}))) as {
                code?: string;
            };
            return {
                ok: false,
                code: body.code === 'closed' ? 'closed' : 'not_found',
            };
        }
        return { ok: false, code: 'error' };
    } catch {
        return { ok: false, code: 'error' };
    }
}

export interface ShareState {
    is_public: boolean;
    public_theme: PublicTheme;
    grace_until: string | null;
    can_share: boolean;
}

const shareUrl = (id: string) =>
    `/api/erd2/diagrams/${encodeURIComponent(id)}/share/`;

export async function getShareState(id: string): Promise<ShareState | null> {
    try {
        const res = await authFetch(shareUrl(id));
        return res.ok ? ((await res.json()) as ShareState) : null;
    } catch {
        return null;
    }
}

export type UpdateShareResult =
    | { ok: true; state: ShareState }
    | { ok: false; code: 'pro_required' | 'not_found' | 'error' };

export async function updateShare(
    id: string,
    patch: { is_public?: boolean; public_theme?: PublicTheme }
): Promise<UpdateShareResult> {
    try {
        const res = await authFetch(shareUrl(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (res.ok) {
            return { ok: true, state: (await res.json()) as ShareState };
        }
        if (res.status === 403) return { ok: false, code: 'pro_required' };
        if (res.status === 404) return { ok: false, code: 'not_found' };
        return { ok: false, code: 'error' };
    } catch {
        return { ok: false, code: 'error' };
    }
}

// Абсолютные ссылки для копирования. Базовый путь приложения (/tools/erd) берём из APP_BASE.
export const publicLink = (origin: string, base: string, id: string) =>
    `${origin}${base}/v/${id}`;

export const embedCode = (origin: string, base: string, id: string) =>
    `<iframe src="${origin}${base}/v/${id}/embed" width="100%" height="520" style="border:1px solid #e5e7eb;border-radius:8px" loading="lazy" allowfullscreen></iframe>`;
