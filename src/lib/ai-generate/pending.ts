import Cookies from 'js-cookie';
import type { AiDialect } from './types';

const KEY = 'erd2_ai_pending';
const TTL_MS = 30 * 60 * 1000;

export interface PendingPrompt {
    prompt: string;
    dialect: AiDialect;
    path: string;
    // Пользователь, чей токен был при сохранении (null — запрос сохранён без входа)
    userId: string | null;
    savedAt: number;
}

// id пользователя из JWT access-токена (claim user_id у SimpleJWT); без токена — null.
function currentUserId(): string | null {
    try {
        const token = Cookies.get('access_token');
        if (!token) return null;
        const payload = JSON.parse(
            atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
        ) as { user_id?: string | number; sub?: string | number };
        const id = payload.user_id ?? payload.sub;
        return id === undefined ? null : String(id);
    } catch {
        return null;
    }
}

export function clearPending(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // localStorage недоступен — нечего чистить
    }
}

// Запрос переживает вход: пользователь уходит на /auth/login и возвращается на ту же страницу.
export function savePending(
    // path — маршрут, где после входа должен смонтироваться хост (по умолчанию текущая страница)
    p: { prompt: string; dialect: AiDialect; path?: string },
    now: number = Date.now()
): void {
    try {
        const value: PendingPrompt = {
            prompt: p.prompt,
            dialect: p.dialect,
            path: p.path ?? window.location.pathname,
            userId: currentUserId(),
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
        // Запрос другого пользователя не воспроизводим и не оставляем
        if (value.userId && value.userId !== currentUserId()) {
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
