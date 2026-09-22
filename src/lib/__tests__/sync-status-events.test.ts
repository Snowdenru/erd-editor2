import { describe, it, expect, vi } from 'vitest';
import {
    emitSyncNow,
    onSyncNow,
    emitSyncStatus,
    onSyncStatus,
} from '../sync-status-events';

describe('sync-status-events', () => {
    it('delivers a sync-now request to subscribers', () => {
        const handler = vi.fn();
        const off = onSyncNow(handler);
        emitSyncNow();
        expect(handler).toHaveBeenCalledTimes(1);
        off();
    });

    it('stops delivering sync-now after unsubscribe', () => {
        const handler = vi.fn();
        const off = onSyncNow(handler);
        off();
        emitSyncNow();
        expect(handler).not.toHaveBeenCalled();
    });

    it('delivers the sync status to subscribers', () => {
        const handler = vi.fn();
        const off = onSyncStatus(handler);
        emitSyncStatus('syncing');
        expect(handler).toHaveBeenCalledWith('syncing');
        emitSyncStatus('idle');
        expect(handler).toHaveBeenCalledWith('idle');
        off();
    });
});
