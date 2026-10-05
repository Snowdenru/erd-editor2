import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    isPullPending,
    markPullDone,
    markPullStarted,
    onPullDone,
    whenPullSettled,
} from '../cloud-pull-state';

describe('cloud-pull-state', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        markPullDone();
        vi.useRealTimers();
    });

    it('resolves immediately when no pull is running', async () => {
        expect(isPullPending()).toBe(false);
        await expect(whenPullSettled()).resolves.toBeUndefined();
    });

    it('waits for the pull to finish and notifies subscribers', async () => {
        const handler = vi.fn();
        const off = onPullDone(handler);
        markPullStarted();
        let settled = false;
        void whenPullSettled().then(() => (settled = true));
        await vi.advanceTimersByTimeAsync(100);
        expect(settled).toBe(false);

        markPullDone();
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
        off();
    });

    it('gives up after the timeout so a slow network cannot hold the loader forever', async () => {
        markPullStarted();
        let settled = false;
        void whenPullSettled(1000).then(() => (settled = true));
        await vi.advanceTimersByTimeAsync(1001);
        expect(settled).toBe(true);
    });
});
