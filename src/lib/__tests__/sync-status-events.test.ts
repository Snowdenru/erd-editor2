import { describe, it, expect, vi } from 'vitest';
import {
    emitSyncNow,
    onSyncNow,
    emitSyncStatus,
    onSyncStatus,
    emitSyncNotice,
    onSyncNotice,
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

    it('delivers sync notices to subscribers until unsubscribed', () => {
        const handler = vi.fn();
        const off = onSyncNotice(handler);
        emitSyncNotice({ kind: 'over_limit', reason: 'tables' });
        expect(handler).toHaveBeenCalledWith({
            kind: 'over_limit',
            reason: 'tables',
        });
        off();
        emitSyncNotice({ kind: 'over_limit', reason: 'diagrams' });
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
