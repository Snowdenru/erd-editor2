const SYNC_NOW_EVENT = 'erd2:sync-now';
const SYNC_STATUS_EVENT = 'erd2:sync-status';

export type SyncStatus = 'idle' | 'syncing';

export const emitSyncNow = (): void => {
    window.dispatchEvent(new CustomEvent(SYNC_NOW_EVENT));
};

export const onSyncNow = (handler: () => void): (() => void) => {
    window.addEventListener(SYNC_NOW_EVENT, handler);
    return () => window.removeEventListener(SYNC_NOW_EVENT, handler);
};

export const emitSyncStatus = (status: SyncStatus): void => {
    window.dispatchEvent(
        new CustomEvent(SYNC_STATUS_EVENT, { detail: status })
    );
};

export const onSyncStatus = (
    handler: (status: SyncStatus) => void
): (() => void) => {
    const listener = (event: Event) =>
        handler((event as CustomEvent<SyncStatus>).detail);
    window.addEventListener(SYNC_STATUS_EVENT, listener);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, listener);
};
