// Дымовая проверка ERD2 после выкатки: холодные заходы не дают белого экрана и ведут куда надо.
// Запуск: [APP_BASE=/tools/erd] CHROMIUM_PATH=/путь/к/chrome BASE_URL=https://sqllab.ru node scripts/smoke-erd2.mjs
// Скрипт выставляет erd2_no_track=1, чтобы проверки не попадали в статистику посещений.
// Для ручных проверок достаточно выполнить в консоли: localStorage.setItem('erd2_no_track','1')
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const BASE = (process.env.BASE_URL ?? 'https://sqllab.ru').replace(/\/$/, '');
const APP_PATH =
    (process.env.APP_BASE ?? '').trim().replace(/\/+$/, '') || '/tools/erd2';
const APP = `${BASE}${APP_PATH}`;
const CHROMIUM = process.env.CHROMIUM_PATH;
if (!CHROMIUM) {
    console.error('CHROMIUM_PATH не задан');
    process.exit(2);
}

const failures = [];
const check = (name, ok, details = '') => {
    console.log(
        `${ok ? 'OK  ' : 'FAIL'} ${name}${details ? ` — ${details}` : ''}`
    );
    if (!ok) failures.push(name);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Считаем «белые» кадры: #root уже был непустым (спиннер/контент), а потом опустел.
async function watchRoot(page, ms) {
    const end = Date.now() + ms;
    let seen = false;
    let blank = 0;
    while (Date.now() < end) {
        const n = await page.evaluate(
            () => document.getElementById('root')?.children.length ?? -1
        );
        if (n > 0) seen = true;
        else if (seen) blank += 1;
        await sleep(100);
    }
    return blank;
}

async function scenario(browser, name, fn) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.evaluateOnNewDocument(() => {
        try {
            localStorage.setItem('erd2_no_track', '1');
        } catch {
            /* нет localStorage */
        }
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
        if (r.status() >= 400 && r.url().startsWith(BASE)) {
            errors.push(`${r.status()} ${r.url()}`);
        }
    });
    try {
        await fn(page, context);
        check(
            `${name}: без ошибок страницы и 4xx/5xx`,
            errors.length === 0,
            errors.join('; ')
        );
    } catch (e) {
        check(name, false, String(e?.message ?? e));
    } finally {
        await context.close();
    }
}

const pathOf = (page) => new URL(page.url()).pathname;
const hasH1 = (page) =>
    page.evaluate(() => document.querySelector('h1') !== null);

const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

try {
    await scenario(
        browser,
        'новый посетитель: корень показывает лендинг',
        async (page) => {
            await page.goto(`${APP}/`, { waitUntil: 'load', timeout: 60000 });
            const blank = await watchRoot(page, 4000);
            check(
                `корень: остаётся на ${APP_PATH}/`,
                pathOf(page).replace(/\/$/, '') === APP_PATH,
                pathOf(page)
            );
            check('корень: есть h1 лендинга', await hasH1(page));
            check(
                'корень: нет пустого #root после появления',
                blank === 0,
                `пустых кадров: ${blank}`
            );
        }
    );

    await scenario(browser, '/about#databases', async (page) => {
        await page.goto(`${APP}/about#databases`, {
            waitUntil: 'load',
            timeout: 60000,
        });
        await watchRoot(page, 2000);
        check('about: есть h1', await hasH1(page));
    });

    await scenario(
        browser,
        '/new → редактор, затем возврат на корень',
        async (page) => {
            await page.goto(`${APP}/new`, {
                waitUntil: 'load',
                timeout: 60000,
            });
            const blank = await watchRoot(page, 6000);
            const editorPath = pathOf(page);
            check(
                '/new: ведёт на /d/<id>',
                /\/tools\/erd2\/d\/[A-Za-z0-9_-]+$/.test(editorPath),
                editorPath
            );
            check(
                '/new: нет пустого #root',
                blank === 0,
                `пустых кадров: ${blank}`
            );

            // Тот же контекст (localStorage сохранён): корень должен вернуть в эту же схему.
            await page.goto(`${APP}/`, { waitUntil: 'load', timeout: 60000 });
            await watchRoot(page, 4000);
            check(
                'возвращающийся: корень ведёт в последнюю схему',
                pathOf(page) === editorPath,
                pathOf(page)
            );
        }
    );
} finally {
    await browser.close();
}

if (failures.length > 0) {
    console.error(`\nПровалено проверок: ${failures.length}`);
    process.exit(1);
}
console.log('\nВсе проверки пройдены');
