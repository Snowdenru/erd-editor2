// Анонимный идентификатор сессии для аналитики: живёт, пока открыта вкладка.
// Формат [a-z0-9] и длина до 50 символов диктуются бэкендом (/api/auth/event/).
const KEY = 'erd2_session_id';
let memoryId: string | null = null;

const generate = (): string =>
    (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(
        0,
        40
    );

export function getSessionId(): string {
    try {
        const stored = sessionStorage.getItem(KEY);
        if (stored && /^[a-z0-9]{1,50}$/.test(stored)) {
            return stored;
        }
        const created = generate();
        sessionStorage.setItem(KEY, created);
        return created;
    } catch {
        // sessionStorage недоступен (приватный режим и т.п.) — держим id в памяти
        memoryId ??= generate();
        return memoryId;
    }
}
