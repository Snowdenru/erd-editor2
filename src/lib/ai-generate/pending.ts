import type { AiDialect } from './types';

const KEY = 'erd2_ai_pending';
const TTL_MS = 30 * 60 * 1000;

export interface PendingPrompt {
    prompt: string;
    dialect: AiDialect;
    path: string;
    savedAt: number;
}

// Запрос переживает вход: пользователь уходит на /auth/login и возвращается на ту же страницу.
export function savePending(
    p: { prompt: string; dialect: AiDialect },
    now: number = Date.now()
): void {
    try {
        const value: PendingPrompt = {
            ...p,
            path: window.location.pathname,
            savedAt: now,
        };
        localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
        // localStorage недоступен — после входа придётся ввести описание заново
    }
}

export function consumePending(now: number = Date.now()): PendingPrompt | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as PendingPrompt;
        if (now - value.savedAt > TTL_MS) {
            localStorage.removeItem(KEY);
            return null;
        }
        if (value.path !== window.location.pathname) {
            return null;
        }
        localStorage.removeItem(KEY);
        return value;
    } catch {
        return null;
    }
}
