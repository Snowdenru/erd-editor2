import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
    vi.resetModules();
    return import('../cookie-consent');
};
const metrikaScripts = () =>
    document.head.querySelectorAll('script[src*="mc.yandex.ru"]');

describe('cookie-consent', () => {
    beforeEach(() => {
        localStorage.clear();
        document.head.innerHTML = '';
        delete window.ym;
        delete window.__ERD2_PRERENDER__;
        delete window.__ERD2_REDIRECTING__;
    });

    it('без согласия Метрика не грузится', async () => {
        const { loadMetrika } = await load();
        loadMetrika();
        expect(metrikaScripts()).toHaveLength(0);
        expect(window.ym).toBeUndefined();
    });

    it('с согласием грузится один раз и инициализируется с вебвизором', async () => {
        localStorage.setItem('cookie_consent', 'accepted');
        const { loadMetrika } = await load();
        loadMetrika();
        loadMetrika();
        expect(metrikaScripts()).toHaveLength(1);
        const calls = (window.ym as unknown as { a: unknown[][] }).a;
        expect(calls[0]).toEqual([
            107086505,
            'init',
            expect.objectContaining({ webvisor: true }),
        ]);
    });

    it('«Принять» пишет ключ, шлёт событие и грузит счётчик', async () => {
        const { acceptConsent, hasConsent, CONSENT_EVENT } = await load();
        const onEvent = vi.fn();
        window.addEventListener(CONSENT_EVENT, onEvent);
        acceptConsent();
        expect(localStorage.getItem('cookie_consent')).toBe('accepted');
        expect(hasConsent()).toBe(true);
        expect(onEvent).toHaveBeenCalledTimes(1);
        expect(metrikaScripts()).toHaveLength(1);
        window.removeEventListener(CONSENT_EVENT, onEvent);
    });

    it('при предрендере и редиректе не грузится даже с согласием', async () => {
        localStorage.setItem('cookie_consent', 'accepted');
        window.__ERD2_PRERENDER__ = true;
        const { loadMetrika } = await load();
        loadMetrika();
        expect(metrikaScripts()).toHaveLength(0);
    });

    it('шлёт hit при pushState и не дублирует тот же адрес', async () => {
        localStorage.setItem('cookie_consent', 'accepted');
        const { loadMetrika } = await load();
        loadMetrika();
        history.pushState({}, '', '/tools/erd/templates');
        history.replaceState({}, '', '/tools/erd/templates');
        const hits = (window.ym as unknown as { a: unknown[][] }).a.filter(
            (c) => c[1] === 'hit'
        );
        expect(hits).toHaveLength(1);
        expect(hits[0][2]).toContain('/tools/erd/templates');
    });
});
