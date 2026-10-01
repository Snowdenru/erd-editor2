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
    marker?: string | null;
    prerender?: boolean;
}) => {
    const replace = vi.fn();
    const fakeLocation = {
        pathname: opts.pathname,
        search: opts.search ?? '',
        replace,
    };
    const fakeStorage = {
        getItem: () => (opts.marker === undefined ? null : opts.marker),
    };
    const fakeWindow = { __ERD2_PRERENDER__: opts.prerender };
    new Function('window', 'location', 'localStorage', body ?? '')(
        fakeWindow,
        fakeLocation,
        fakeStorage
    );
    return replace;
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
});
