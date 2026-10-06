import { DISABLE_ANALYTICS } from '@/lib/env';

// Ключ и событие общие с основным сайтом sqllab.ru (тот же origin): кто принял куки там,
// баннер здесь не увидит, и наоборот.
export const CONSENT_KEY = 'cookie_consent';
export const CONSENT_EVENT = 'cookie_consent_updated';

// Тот же счётчик, что на основном сайте: статистику /tools/erd/ смотрим в одном месте.
const METRIKA_ID = 107086505;
const METRIKA_SRC = 'https://mc.yandex.ru/metrika/tag.js';

type Ym = (id: number, action: string, ...args: unknown[]) => void;

declare global {
    interface Window {
        ym?: Ym & { a?: unknown[]; l?: number };
        __ERD2_PRERENDER__?: boolean;
        __ERD2_REDIRECTING__?: boolean;
    }
}

export function hasAnsweredConsent(): boolean {
    try {
        return localStorage.getItem(CONSENT_KEY) !== null;
    } catch {
        // localStorage недоступен — баннер не показываем: ответ всё равно негде сохранить
        return true;
    }
}

export function hasConsent(): boolean {
    try {
        return localStorage.getItem(CONSENT_KEY) === 'accepted';
    } catch {
        return false;
    }
}

export function acceptConsent(): void {
    try {
        localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {
        // приватный режим — загрузим счётчик на эту сессию ниже
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
    loadMetrika(true);
}

// Предрендер, редирект на последнюю схему и флаг erd2_no_track — те же условия, что у Fathom
// в index.html: ни визита со сборки, ни тега в сохранённом about.html не нужно.
function trackingDisabled(): boolean {
    if (DISABLE_ANALYTICS) return true;
    if (window.__ERD2_PRERENDER__ || window.__ERD2_REDIRECTING__) return true;
    try {
        return localStorage.getItem('erd2_no_track') === '1';
    } catch {
        return false;
    }
}

let loaded = false;

// Грузит Метрику, если есть согласие. Повторный вызов ничего не делает.
// `consented` нужен, когда localStorage не записался (приватный режим), а человек нажал «Принять».
export function loadMetrika(consented = hasConsent()): void {
    if (loaded || !consented || trackingDisabled()) return;
    loaded = true;

    const ym: NonNullable<Window['ym']> =
        window.ym ??
        Object.assign(
            function (...args: unknown[]) {
                (ym.a = ym.a ?? []).push(args);
            } as Ym,
            { l: Date.now() }
        );
    window.ym = ym;

    const script = document.createElement('script');
    script.async = true;
    script.src = METRIKA_SRC;
    document.head.appendChild(script);

    ym(METRIKA_ID, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
    });

    trackSpaNavigation(ym);
}

// Переходы внутри SPA не перезагружают страницу: шлём хит сами. Первый хит отправляет init;
// повтор того же адреса (редирект между маршрутами) гасим.
function trackSpaNavigation(ym: Ym): void {
    let lastHit = location.href;
    const sendHit = () => {
        if (location.href === lastHit) return;
        const referer = lastHit;
        lastHit = location.href;
        ym(METRIKA_ID, 'hit', location.href, { referer });
    };
    (['pushState', 'replaceState'] as const).forEach((name) => {
        const original = history[name];
        history[name] = function (this: History, ...args) {
            const result = original.apply(this, args);
            sendHit();
            return result;
        } as typeof original;
    });
    window.addEventListener('popstate', sendHit);
}
