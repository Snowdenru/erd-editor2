import { authFetch } from '@/lib/sqllab-auth';

export const REVIEW_TAGS = {
    low: [
        'Сложно разобраться',
        'Не хватает функций',
        'Баги или зависания',
        'Медленно',
        'Ограничения Free',
        'Неудобный экспорт',
    ],
    mid: [
        'Нужно больше шаблонов',
        'Не хватает экспорта',
        'Хочу совместную работу',
        'Хороший старт',
    ],
    high: [
        'Удобный интерфейс',
        'Быстро',
        'Красивые схемы',
        'Импорт DDL/DBML',
        'Удобный экспорт',
        'Рекомендую коллегам',
    ],
} as const;

export const tagsForRating = (rating: number): readonly string[] => {
    if (rating <= 2) return REVIEW_TAGS.low;
    if (rating === 3) return REVIEW_TAGS.mid;
    return REVIEW_TAGS.high;
};

export interface Erd2Review {
    rating: number;
    tags: string[];
    text: string;
}

const ENDPOINT = '/api/reviews/tool/erd2/';
const DISMISSED_KEY = 'erd2_review_dismissed_at';
const DONE_KEY = 'erd2_review_done';
const DISMISS_DAYS = 30;
// Окно после экспорта: свой счётчик, не зависит от закрытого приглашения и от «уже оценил» —
// через неделю мнение могло измениться, форма подставит прежнюю оценку для правки
const EXPORT_PROMPTED_KEY = 'erd2_review_export_prompted_at';
const EXPORT_PROMPT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchMyReview(): Promise<Erd2Review | null> {
    const res = await authFetch(ENDPOINT);
    if (!res.ok) {
        throw new Error(`review: HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
        review: (Erd2Review & { updated_at: string }) | null;
    };
    if (!data.review) {
        return null;
    }
    const { rating, tags, text } = data.review;
    return { rating, tags, text };
}

export async function submitReview(review: Erd2Review): Promise<void> {
    const res = await authFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
    });
    if (!res.ok) {
        throw new Error(`review: HTTP ${res.status}`);
    }
}

export function canAutoPrompt(now: number = Date.now()): boolean {
    try {
        if (localStorage.getItem(DONE_KEY)) {
            return false;
        }
        const raw = localStorage.getItem(DISMISSED_KEY);
        if (raw === null) {
            return true;
        }
        const dismissed = Number(raw);
        return (
            Number.isNaN(dismissed) || now - dismissed >= DISMISS_DAYS * DAY_MS
        );
    } catch {
        return true;
    }
}

export function markPromptDismissed(now: number = Date.now()): void {
    try {
        localStorage.setItem(DISMISSED_KEY, String(now));
    } catch {
        // ignore
    }
}

export function markReviewed(): void {
    try {
        localStorage.setItem(DONE_KEY, '1');
    } catch {
        // ignore
    }
}

export function canExportPrompt(now: number = Date.now()): boolean {
    try {
        const raw = localStorage.getItem(EXPORT_PROMPTED_KEY);
        if (raw === null) {
            return true;
        }
        const prompted = Number(raw);
        return (
            Number.isNaN(prompted) ||
            now - prompted >= EXPORT_PROMPT_DAYS * DAY_MS
        );
    } catch {
        return true;
    }
}

export function markExportPrompted(now: number = Date.now()): void {
    try {
        localStorage.setItem(EXPORT_PROMPTED_KEY, String(now));
    } catch {
        // ignore
    }
}
