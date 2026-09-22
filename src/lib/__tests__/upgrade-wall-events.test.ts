import { describe, it, expect, vi } from 'vitest';
import { emitUpgradeWall, onUpgradeWall } from '../upgrade-wall-events';

describe('upgrade-wall-events', () => {
    it('delivers the emitted detail to subscribers', () => {
        const handler = vi.fn();
        const off = onUpgradeWall(handler);
        emitUpgradeWall({ reason: 'table_limit', limit: 10 });
        expect(handler).toHaveBeenCalledWith({
            reason: 'table_limit',
            limit: 10,
        });
        off();
    });

    it('stops delivering after unsubscribe', () => {
        const handler = vi.fn();
        const off = onUpgradeWall(handler);
        off();
        emitUpgradeWall({ reason: 'diagram_limit' });
        expect(handler).not.toHaveBeenCalled();
    });
});
