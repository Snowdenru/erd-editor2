const RELOAD_FLAG_KEY = 'stale-chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

const STALE_CHUNK_MESSAGES = [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module',
];

// После деплоя хеши файлов меняются: вкладка со старым бандлом просит чанк, которого уже нет
export const isStaleChunkError = (error: unknown): boolean => {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : '';
    return STALE_CHUNK_MESSAGES.some((text) => message.includes(text));
};

// Перезагружает страницу один раз (с защитой от бесконечного цикла) — новая версия подтянет свежие хеши
export const reloadOnceForStaleChunk = (): boolean => {
    try {
        const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG_KEY));
        if (lastReload && Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
            return false;
        }
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
    } catch {
        // sessionStorage может быть недоступен — тогда просто перезагружаем без защиты
    }
    window.location.reload();
    return true;
};
