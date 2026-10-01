import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForPrerenderedPage } from '../wait-for-prerendered-page';

const makeRouter = (initialized: boolean) => {
    let listener: ((s: { initialized: boolean }) => void) | undefined;
    const unsubscribe = vi.fn();
    return {
        state: { initialized },
        subscribe: vi.fn((fn: (s: { initialized: boolean }) => void) => {
            listener = fn;
            return unsubscribe;
        }),
        emit: (v: boolean) => listener?.({ initialized: v }),
        unsubscribe,
    };
};

const makeRoot = (html: string) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
};

describe('waitForPrerenderedPage', () => {
    afterEach(() => vi.useRealTimers());

    it('не ждёт, если #root пуст', async () => {
        const router = makeRouter(false);
        await waitForPrerenderedPage(makeRoot(''), router);
        expect(router.subscribe).not.toHaveBeenCalled();
    });

    it('ждёт инициализации роутера, если в #root только сплэш (холодный запуск /tools/erd2)', async () => {
        const router = makeRouter(false);
        let resolved = false;
        const p = waitForPrerenderedPage(
            makeRoot('<div class="app-splash"><span></span></div>'),
            router
        ).then(() => (resolved = true));
        await Promise.resolve();
        expect(router.subscribe).toHaveBeenCalled();
        expect(resolved).toBe(false);
        router.emit(true);
        await p;
        expect(resolved).toBe(true);
    });

    it('не ждёт, если роутер уже инициализирован', async () => {
        const router = makeRouter(true);
        await waitForPrerenderedPage(makeRoot('<h1>x</h1>'), router);
        expect(router.subscribe).not.toHaveBeenCalled();
    });

    it('ждёт инициализации роутера при предрендере', async () => {
        const router = makeRouter(false);
        let resolved = false;
        const p = waitForPrerenderedPage(makeRoot('<h1>x</h1>'), router).then(
            () => (resolved = true)
        );
        router.emit(false);
        await Promise.resolve();
        expect(resolved).toBe(false);
        router.emit(true);
        await p;
        expect(resolved).toBe(true);
        expect(router.unsubscribe).toHaveBeenCalled();
    });

    it('снимается по таймауту, если роутер не инициализировался', async () => {
        vi.useFakeTimers();
        const router = makeRouter(false);
        const p = waitForPrerenderedPage(makeRoot('<h1>x</h1>'), router, 3000);
        await vi.advanceTimersByTimeAsync(3000);
        await p;
        expect(router.unsubscribe).toHaveBeenCalled();
    });
});
