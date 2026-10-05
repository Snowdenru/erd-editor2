// Идёт ли подтягивание облачных схем в IndexedDB (CloudPullProvider). Загрузчик схемы и диалог
// «Мои схемы» стартуют раньше, чем pull закончит: без этого сигнала они решают по неполным данным —
// открывают диалог для схемы, которую pull вот-вот положит в IndexedDB, или показывают неполный список.
let pending = false;
const waiters = new Set<() => void>();
const EVENT_NAME = 'erd2:cloud-pull-done';

export const isPullPending = (): boolean => pending;

export const markPullStarted = (): void => {
    pending = true;
};

export const markPullDone = (): void => {
    pending = false;
    for (const resolve of [...waiters]) resolve();
    window.dispatchEvent(new Event(EVENT_NAME));
};

export const onPullDone = (handler: () => void): (() => void) => {
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
};

// Ждёт конец pull, но не дольше timeoutMs: медленная сеть не должна держать загрузчик вечно.
export const whenPullSettled = (timeoutMs = 8000): Promise<void> =>
    new Promise((resolve) => {
        if (!pending) {
            resolve();
            return;
        }
        const done = () => {
            clearTimeout(timer);
            waiters.delete(done);
            resolve();
        };
        const timer = setTimeout(done, timeoutMs);
        waiters.add(done);
    });
