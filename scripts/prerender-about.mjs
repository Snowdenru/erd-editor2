// Предрендер страницы /tools/erd2/about в dist/about.html (puppeteer-core + системный Chromium).
import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BASE = '/tools/erd2/';
const ROUTE = `${BASE}about`;
const DIST = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'dist'
);
const REQUIRED = process.env.PRERENDER_REQUIRED === '1';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
};

const fail = (msg) => {
    console.error(`[prerender] ОШИБКА: ${msg}`);
    process.exit(1);
};

async function fileExists(p) {
    try {
        return (await stat(p)).isFile();
    } catch {
        return false;
    }
}

function startServer() {
    const server = http.createServer(async (req, res) => {
        try {
            const { pathname } = new URL(req.url ?? '/', 'http://x');
            let file = path.join(DIST, 'index.html');
            if (pathname.startsWith(BASE)) {
                const rel = decodeURIComponent(pathname.slice(BASE.length));
                const candidate = path.normalize(path.join(DIST, rel));
                if (
                    rel &&
                    candidate.startsWith(DIST + path.sep) &&
                    (await fileExists(candidate))
                ) {
                    file = candidate;
                }
            }
            const body = await readFile(file);
            res.writeHead(200, {
                'Content-Type':
                    MIME[path.extname(file).toLowerCase()] ??
                    'application/octet-stream',
            });
            res.end(body);
        } catch (e) {
            res.writeHead(500);
            res.end(String(e));
        }
    });
    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () => resolve(server))
    );
}

async function main() {
    const chromium = process.env.CHROMIUM_PATH;
    if (!chromium) {
        if (REQUIRED) {
            fail('CHROMIUM_PATH не задан, а PRERENDER_REQUIRED=1');
        }
        console.warn(
            '[prerender] ПРЕДУПРЕЖДЕНИЕ: CHROMIUM_PATH не задан — предрендер пропущен (dist/about.html не создан)'
        );
        return;
    }
    if (!(await fileExists(path.join(DIST, 'index.html')))) {
        fail('dist/index.html не найден — сначала выполните vite build');
    }

    const { default: puppeteer } = await import('puppeteer-core');
    const server = await startServer();
    const { port } = server.address();
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: chromium,
            headless: true,
            args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            window.__ERD2_PRERENDER__ = true;
        });
        const apiCalls = [];
        page.on('request', (r) => {
            const u = r.url();
            if (!u.startsWith('data:') && !u.includes(`:${port}${BASE}`)) {
                apiCalls.push(`external ${r.method()} ${u}`);
            } else if (u.includes('/api/')) {
                apiCalls.push(`${r.method()} ${u}`);
            }
        });
        page.on('pageerror', (e) =>
            console.warn(`[prerender] pageerror: ${e.message}`)
        );

        await page.goto(`http://127.0.0.1:${port}${ROUTE}`, {
            waitUntil: 'load',
            timeout: 60000,
        });
        await page.waitForSelector('h1', { timeout: 60000 });
        await page.waitForSelector('#databases', { timeout: 60000 });
        await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 });

        const html = await page.content();
        const textLen = await page.evaluate(
            () => document.body.innerText.length
        );
        if (!html.includes('<h1')) fail('в результате нет <h1');
        if (textLen < 1500)
            fail(`видимого текста слишком мало: ${textLen} < 1500`);
        if (!html.includes('application/ld+json'))
            fail('нет application/ld+json');

        await writeFile(path.join(DIST, 'about.html'), html);
        console.log(
            `[prerender] OK dist/about.html: ${html.length} байт, видимый текст ${textLen} симв.`
        );
        console.log(
            `[prerender] запросы к /api/ или внешние: ${apiCalls.length ? '\n  ' + apiCalls.join('\n  ') : 'нет'}`
        );
    } finally {
        if (browser) await browser.close().catch(() => undefined);
        server.close();
    }
}

main().catch((e) => fail(e?.stack ?? String(e)));
