// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(
    fileURLToPath(new URL('../../../index.html', import.meta.url)),
    'utf8'
);
const body = /<script id="erd2-entry">([\s\S]*?)<\/script>/.exec(html)?.[1];

const run = (opts: {
    pathname: string;
    search?: string;
    hash?: string;
    marker?: string | null;
    prerender?: boolean;
    sessionThrows?: boolean;
}) => {
    const replace = vi.fn();
    const fakeLocation = {
        pathname: opts.pathname,
        search: opts.search ?? '',
        hash: opts.hash ?? '',
        replace,
    };
    const fakeStorage = {
        getItem: () => (opts.marker === undefined ? null : opts.marker),
    };
    const sessionData: Record<string, string> = {};
    const fakeSession = {
        setItem: (k: string, v: string) => {
            if (opts.sessionThrows) throw new Error('private mode');
            sessionData[k] = v;
        },
    };
    const style = { visibility: '' };
    const fakeWindow: {
        __ERD2_PRERENDER__?: boolean;
        __ERD2_REDIRECTING__?: boolean;
        setTimeout: ReturnType<typeof vi.fn>;
        addEventListener: ReturnType<typeof vi.fn>;
    } = {
        __ERD2_PRERENDER__: opts.prerender,
        setTimeout: vi.fn(),
        addEventListener: vi.fn(),
    };
    const fakeDocument = { documentElement: { style } };
    new Function(
        'window',
        'location',
        'localStorage',
        'sessionStorage',
        'document',
        body ?? ''
    )(fakeWindow, fakeLocation, fakeStorage, fakeSession, fakeDocument);
    return Object.assign(replace, { fakeWindow, sessionData, style });
};

describe('скрипт быстрого входа erd2-entry', () => {
    it('скрипт есть в index.html', () => {
        expect(body).toBeTruthy();
    });

    it('корень + маркер → редирект на последнюю схему', () => {
        expect(
            run({ pathname: '/tools/erd2/', marker: 'abc_1' })
        ).toHaveBeenCalledWith('/tools/erd2/d/abc_1');
        expect(
            run({ pathname: '/tools/erd2', marker: 'abc_1' })
        ).toHaveBeenCalledWith('/tools/erd2/d/abc_1');
    });

    it('нет маркера → лендинг (редиректа нет)', () => {
        expect(
            run({ pathname: '/tools/erd2/', marker: null })
        ).not.toHaveBeenCalled();
    });

    it('не-корневые адреса не трогает', () => {
        expect(
            run({ pathname: '/tools/erd2/about', marker: 'abc' })
        ).not.toHaveBeenCalled();
        expect(
            run({ pathname: '/tools/erd2/new', marker: 'abc' })
        ).not.toHaveBeenCalled();
    });

    it('с query (глубокие ссылки) не редиректит', () => {
        expect(
            run({
                pathname: '/tools/erd2/',
                search: '?open=import',
                marker: 'abc',
            })
        ).not.toHaveBeenCalled();
    });

    it('не редиректит при предрендере', () => {
        expect(
            run({ pathname: '/tools/erd2/', marker: 'abc', prerender: true })
        ).not.toHaveBeenCalled();
    });

    it('игнорирует подозрительный маркер', () => {
        expect(
            run({ pathname: '/tools/erd2/', marker: '../evil' })
        ).not.toHaveBeenCalled();
        expect(
            run({ pathname: '/tools/erd2/', marker: 'a/b' })
        ).not.toHaveBeenCalled();
    });

    it('перед редиректом ставит флаг, прячет страницу и помечает сессию', () => {
        const r = run({ pathname: '/tools/erd2/', marker: 'abc_1' });
        expect(r.fakeWindow.__ERD2_REDIRECTING__).toBe(true);
        expect(r.style.visibility).toBe('hidden');
        expect(r.sessionData.erd2_entry_redirect).toBe('1');
    });

    it('без редиректа флаг, скрытие и пометка сессии не ставятся', () => {
        for (const o of [
            { pathname: '/tools/erd2/', marker: null },
            { pathname: '/tools/erd2/about', marker: 'abc' },
            { pathname: '/tools/erd2/', marker: 'abc', prerender: true },
            { pathname: '/tools/erd2/', marker: '../evil' },
        ]) {
            const r = run(o);
            expect(r.fakeWindow.__ERD2_REDIRECTING__).toBeUndefined();
            expect(r.style.visibility).toBe('');
            expect(r.sessionData.erd2_entry_redirect).toBeUndefined();
        }
    });

    it('sessionStorage недоступен (приватный режим) — редирект всё равно выполняется', () => {
        const r = run({
            pathname: '/tools/erd2/',
            marker: 'abc_1',
            sessionThrows: true,
        });
        expect(r).toHaveBeenCalledWith('/tools/erd2/d/abc_1');
    });

    it('страховка: таймер 5 с снимает скрытие и флаг', () => {
        const r = run({ pathname: '/tools/erd2/', marker: 'abc_1' });
        expect(r.fakeWindow.setTimeout).toHaveBeenCalledTimes(1);
        const [cb, ms] = r.fakeWindow.setTimeout.mock.calls[0];
        expect(ms).toBe(5000);
        expect(r.style.visibility).toBe('hidden');
        cb();
        expect(r.style.visibility).toBe('');
        expect(r.fakeWindow.__ERD2_REDIRECTING__).toBe(false);
    });

    it('страховка: pageshow с persisted (bfcache) восстанавливает страницу', () => {
        const r = run({ pathname: '/tools/erd2/', marker: 'abc_1' });
        const call = r.fakeWindow.addEventListener.mock.calls.find(
            (c) => c[0] === 'pageshow'
        );
        expect(call).toBeTruthy();
        const handler = call![1];
        handler({ persisted: false });
        expect(r.style.visibility).toBe('hidden');
        handler({ persisted: true });
        expect(r.style.visibility).toBe('');
        expect(r.fakeWindow.__ERD2_REDIRECTING__).toBe(false);
    });

    it('без редиректа таймер и pageshow-слушатель не ставятся', () => {
        const r = run({ pathname: '/tools/erd2/', marker: null });
        expect(r.fakeWindow.setTimeout).not.toHaveBeenCalled();
        expect(r.fakeWindow.addEventListener).not.toHaveBeenCalled();
    });
});
