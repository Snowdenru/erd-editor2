import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ChartDBLogo from '@/assets/sqllab-logo-light.svg';
import ChartDBDarkLogo from '@/assets/sqllab-logo-dark.svg';
import AboutHeroImage from '@/assets/about/hero-light.png';
import AboutEditorDarkImage from '@/assets/about/editor-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ThemeProvider } from '@/context/theme-context/theme-provider';
import { Button } from '@/components/button/button';
import { StorageProvider } from '@/context/storage-context/storage-provider';
import { DdlTryBlock } from './ddl-try-block';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/accordion/accordion';
import { DatabaseType } from '@/lib/domain/database-type';
import { databaseLogoMap } from '@/lib/databases';
import {
    Check,
    Code2,
    Database,
    FileCode,
    GraduationCap,
    Image as ImageIcon,
    LayoutTemplate,
    Layers,
    PencilLine,
    Save,
    Undo2,
    Upload,
    Zap,
} from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

const DIALECTS: Array<{ name: string; type: DatabaseType }> = [
    { name: 'PostgreSQL', type: DatabaseType.POSTGRESQL },
    { name: 'MySQL', type: DatabaseType.MYSQL },
    { name: 'SQL Server', type: DatabaseType.SQL_SERVER },
    { name: 'SQLite', type: DatabaseType.SQLITE },
    { name: 'MariaDB', type: DatabaseType.MARIADB },
    { name: 'ClickHouse', type: DatabaseType.CLICKHOUSE },
    { name: 'CockroachDB', type: DatabaseType.COCKROACHDB },
    { name: 'Oracle', type: DatabaseType.ORACLE },
];

const FEATURE_CARD_MAIN = {
    icon: Database as IconType,
    tag: 'Любая БД',
    to: '/tools/erd2/?open=import',
    title: 'Импорт из вашей базы',
    description:
        'Вставьте DDL, DBML или результат нашего SQL-запроса — схема строится сразу, а живой предпросмотр обновляется по мере ввода.',
    className: 'bg-lime-200 dark:bg-lime-900/40',
};

const FEATURE_CARDS: Array<{
    icon: IconType;
    tag: string;
    to: string;
    title: string;
    description: string;
    className: string;
}> = [
    {
        icon: Zap,
        tag: 'Быстро',
        to: '/tools/erd2/?open=import',
        title: 'Мгновенный импорт',
        description:
            'Один запрос забирает всю схему вашей базы целиком — без доступа к самой базе данных.',
        className: 'bg-purple-200 dark:bg-purple-900/40',
    },
    {
        icon: FileCode,
        tag: 'Просто',
        to: '/tools/erd2/?tab=ddl',
        title: 'Экспорт SQL',
        description:
            'Чистые DDL-скрипты для нужного диалекта: PostgreSQL, MySQL, SQL Server и других.',
        className: 'bg-teal-100 dark:bg-teal-900/40',
    },
    {
        icon: Code2,
        tag: 'Онлайн',
        to: '/tools/erd2/?tab=ddl',
        title: 'Вкладки DDL и DBML',
        description:
            'Схема всегда под рукой как код: DDL для базы и DBML для правок прямо в боковой панели.',
        className: 'bg-yellow-100 dark:bg-yellow-900/40',
    },
    {
        icon: LayoutTemplate,
        tag: 'Готово',
        to: '/tools/erd2/templates',
        title: 'Готовые шаблоны',
        description:
            '50 схем реальных проектов и учебные базы — Employees, Bike Stores, DVD Rental.',
        className: 'bg-pink-200 dark:bg-pink-900/40',
    },
    {
        icon: ImageIcon,
        tag: 'Делитесь',
        to: '/tools/erd2/',
        title: 'Экспорт в изображение',
        description:
            'SVG и PNG для документации, JSON для резервной копии, DBML для других инструментов.',
        className: 'bg-orange-200 dark:bg-orange-900/40',
    },
    {
        icon: Undo2,
        tag: 'Удобно',
        to: '/tools/erd2/',
        title: 'Порядок на холсте',
        description:
            'Отмена и повтор, автораскладка, области и заметки — с большими схемами работать легко.',
        className: 'bg-sky-200 dark:bg-sky-900/40',
    },
];

const WORKFLOW_ITEMS: Array<{
    icon: IconType;
    title: string;
    description: string;
    tag: string;
    tagClassName: string;
}> = [
    {
        icon: Zap,
        title: 'Мгновенный импорт',
        description:
            'Для каждой базы мы подготовили один запрос, который забирает всю схему целиком. На это уходят считанные секунды.',
        tag: 'SQL',
        tagClassName: 'bg-fuchsia-300 dark:bg-fuchsia-700',
    },
    {
        icon: Database,
        title: 'Реляционные СУБД',
        description:
            'Полная поддержка популярных СУБД — MySQL, MariaDB, PostgreSQL, SQL Server и SQLite, а также Oracle, CockroachDB и ClickHouse.',
        tag: 'БД',
        tagClassName: 'bg-blue-100 dark:bg-blue-900',
    },
    {
        icon: Upload,
        title: 'Экспорт',
        description:
            'Скачивайте схему как SQL-скрипт (DDL), чтобы запустить его в своей базе, или как изображение для документации.',
        tag: 'БД',
        tagClassName: 'bg-blue-100 dark:bg-blue-900',
    },
    {
        icon: Layers,
        title: 'Примеры',
        description:
            'Стартуйте с готовых схем — они дают быструю основу и вдохновение для собственного дизайна.',
        tag: 'Шаблоны',
        tagClassName: 'bg-orange-100 dark:bg-orange-900',
    },
    {
        icon: PencilLine,
        title: 'Удобный редактор',
        description:
            'Отмена и повтор, создание и настройка таблиц и связей — работа над схемой без лишних движений.',
        tag: 'БД',
        tagClassName: 'bg-blue-100 dark:bg-blue-900',
    },
    {
        icon: Save,
        title: 'Резервные копии',
        description:
            'Сохраняйте диаграмму в JSON и возвращайтесь к ней позже — файл можно импортировать обратно.',
        tag: 'Файл',
        tagClassName: 'bg-green-100 dark:bg-green-900',
    },
];

const SectionPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-block rounded-full border border-foreground/70 px-4 py-1 text-sm font-medium">
        {children}
    </span>
);

const IconTile: React.FC<{ icon: IconType }> = ({ icon: Icon }) => (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm">
        <Icon className="size-8" />
    </span>
);

const HEADER_LINKS: Array<{ label: string; href: string }> = [
    { label: 'Возможности', href: '#features' },
    { label: 'Поддержка БД', href: '#databases' },
    { label: 'Шаблоны', href: '/tools/erd2/templates' },
    { label: 'Инструменты', href: '/tools' },
    { label: 'Цены', href: '/plans' },
];

const FOOTER_COLUMNS: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
}> = [
    {
        title: 'Продукт',
        links: [
            { label: 'Цены', href: '/plans' },
            { label: 'Импорт из вашей БД', href: '/tools/erd2/' },
            { label: 'Шаблоны', href: '/tools/erd2/templates' },
            { label: 'Старый ERD-редактор', href: '/tools/erd' },
        ],
    },
    {
        title: 'Бесплатные инструменты',
        links: [
            { label: 'Все SQL-инструменты', href: '/tools' },
            { label: 'SQL-форматтер', href: '/tools/formatter' },
            { label: 'SQL-линтер', href: '/tools/linter' },
            { label: 'Schema Diff', href: '/tools/diff' },
            { label: 'Объяснение запроса', href: '/tools/describe' },
            { label: 'EXPLAIN-визуализатор', href: '/tools/explain' },
            { label: 'Генератор тестовых данных', href: '/tools/datagen' },
            { label: 'JSON → SQL', href: '/tools/json-to-sql' },
        ],
    },
    {
        title: 'Обучение',
        links: [
            { label: 'Курсы SQL', href: '/courses' },
            { label: 'Практика', href: '/practice' },
            { label: 'Справочник', href: '/reference' },
            { label: 'Статьи', href: '/articles' },
            { label: 'Подготовка к собеседованию', href: '/interview' },
        ],
    },
    {
        title: 'О проекте',
        links: [
            { label: 'SQL Lab', href: '/' },
            { label: 'Блог', href: '/blog' },
            {
                label: 'Исходный код',
                href: 'https://github.com/Snowdenru/erd-editor2',
            },
        ],
    },
];

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
    {
        question: 'Подключается ли ERD2 напрямую к моей базе данных?',
        answer: 'Нет. Вы либо вставляете готовый DDL/DBML, либо запускаете предложенный SQL-скрипт в своей базе и вставляете результат сюда — прямого доступа к вашей базе инструмент не запрашивает.',
    },
    {
        question: 'Как быстрее всего начать?',
        answer: 'Нажмите «Импорт из вашей БД», выберите тип базы и вставьте DDL или DBML — или начните с одного из готовых примеров либо из 50 шаблонов.',
    },
    {
        question: 'Чем Free отличается от Pro?',
        answer: 'На Free доступно 3 сохранённые диаграммы, на Pro — без ограничений.',
    },
    {
        question: 'В каких форматах можно экспортировать схему?',
        answer: 'SVG, PNG, SQL DDL, DBML и JSON.',
    },
    {
        question: 'Что если моей СУБД нет в списке?',
        answer: 'Сейчас поддерживаются PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, CockroachDB и ClickHouse — этого достаточно для подавляющего большинства схем.',
    },
];

const AboutPageComponent: React.FC = () => {
    const { effectiveTheme } = useTheme();

    return (
        <>
            <Helmet>
                <title>SQL Lab ERD — визуальный редактор баз данных</title>
                <meta
                    name="description"
                    content="Бесплатный онлайн-редактор ER-диаграмм: вставьте DDL или SQL-запрос — получите готовую схему за секунды."
                />
            </Helmet>
            <section className="flex w-screen flex-col overflow-x-hidden bg-background">
                <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
                    <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-6">
                        <a
                            href="https://sqllab.ru"
                            className="flex shrink-0 cursor-pointer items-center"
                            rel="noreferrer"
                        >
                            <img
                                src={
                                    effectiveTheme === 'light'
                                        ? ChartDBLogo
                                        : ChartDBDarkLogo
                                }
                                alt="SQL Lab"
                                className="h-4 max-w-fit"
                            />
                        </a>
                        <div className="hidden items-center gap-1 md:flex">
                            {HEADER_LINKS.map(({ label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                                >
                                    {label}
                                </a>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href="/courses"
                                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950"
                            >
                                <GraduationCap className="size-4" />
                                Изучать SQL
                            </a>
                            <Button
                                asChild
                                size="sm"
                                className="hidden sm:inline-flex"
                            >
                                <Link to="/">Открыть редактор</Link>
                            </Button>
                        </div>
                    </nav>
                </header>

                {/* 1. Hero */}
                <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
                    <div className="flex flex-col items-start gap-5">
                        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                            Визуализируйте свою базу данных, редактор
                            ER-диаграмм
                        </h1>
                        <p className="text-xl font-semibold sm:text-2xl">
                            Редактор диаграмм БД для{' '}
                            <span className="text-pink-600">
                                документации и проектирования.
                            </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="h-12 rounded-xl bg-foreground px-8 text-base text-background hover:bg-foreground/85"
                            >
                                <Link to="/">Открыть редактор</Link>
                            </Button>
                            <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="h-12 rounded-xl border-2 px-8 text-base"
                            >
                                <Link to="/templates">Смотреть шаблоны</Link>
                            </Button>
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="size-5" />
                                Бесплатно, без установки
                            </span>
                        </div>
                        <p className="text-lg font-semibold">
                            Всё без доступа к вашей базе данных
                        </p>
                    </div>
                    <div className="relative">
                        <span className="absolute -top-3 right-2 z-10 rounded-lg border border-green-600 bg-green-50 px-4 py-1.5 text-base font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
                            Онлайн
                        </span>
                        <img
                            src={AboutHeroImage}
                            alt="Пример ER-диаграммы в редакторе SQL Lab"
                            className="w-full rounded-2xl border bg-white shadow-xl"
                        />
                    </div>
                </div>

                {/* 2. Карточка «Онлайн-редактор» */}
                <div className="mx-auto w-full max-w-7xl px-6 pb-20">
                    <div className="grid items-center gap-10 rounded-[2.5rem] bg-gradient-to-br from-pink-600 to-rose-500 p-8 text-white sm:p-12 lg:grid-cols-2">
                        <div className="flex flex-col items-start gap-6">
                            <h2 className="text-4xl font-bold sm:text-5xl">
                                SQL Lab <span className="text-black">ERD</span>
                            </h2>
                            <p className="text-xl leading-relaxed sm:text-2xl">
                                Визуализируйте базы данных мгновенно — прямо в
                                браузере. Ничего не нужно устанавливать:
                                откройте вкладку и начинайте.
                            </p>
                            <div>
                                <p className="text-2xl font-bold">
                                    Всё без доступа к базе данных
                                </p>
                                <p className="text-xl">
                                    Получите диаграмму из DDL за считанные
                                    секунды
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    asChild
                                    size="lg"
                                    className="h-14 rounded-full bg-black px-8 text-lg text-white hover:bg-black/80"
                                >
                                    <Link to="/">
                                        Открыть редактор
                                        <Zap className="ml-2 size-5" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="lg"
                                    className="h-14 rounded-full bg-white px-8 text-lg text-black hover:bg-white/85"
                                >
                                    <Link to="/templates">
                                        Все шаблоны
                                        <LayoutTemplate className="ml-2 size-5" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <img
                            src={AboutEditorDarkImage}
                            alt="Редактор SQL Lab ERD в тёмной теме"
                            className="w-full rounded-xl shadow-2xl"
                        />
                    </div>
                </div>

                {/* Попробовать: вставить DDL */}
                <DdlTryBlock />

                {/* 3. Возможности */}
                <div
                    id="features"
                    className="scroll-mt-14 bg-slate-100/70 py-20 dark:bg-slate-900/40"
                >
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="mb-10 flex flex-col items-center gap-4 text-center">
                            <SectionPill>Много возможностей</SectionPill>
                            <h2 className="text-4xl font-bold sm:text-5xl">
                                Диаграммы схем баз данных
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                Готовы начать?
                            </p>
                        </div>
                        <div className="flex flex-col gap-5">
                            <a
                                href={FEATURE_CARD_MAIN.to}
                                className={`group flex flex-col items-center gap-3 rounded-3xl p-8 text-center transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 ${FEATURE_CARD_MAIN.className}`}
                            >
                                <div className="flex items-center gap-4">
                                    <IconTile icon={FEATURE_CARD_MAIN.icon} />
                                    <span className="rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white">
                                        {FEATURE_CARD_MAIN.tag}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold">
                                    {FEATURE_CARD_MAIN.title}
                                </h3>
                                <p className="max-w-xl text-lg font-medium text-slate-700 dark:text-slate-200">
                                    {FEATURE_CARD_MAIN.description}
                                </p>
                            </a>
                            <div className="grid gap-5 md:grid-cols-3">
                                {FEATURE_CARDS.map(
                                    ({
                                        icon,
                                        tag,
                                        to,
                                        title,
                                        description,
                                        className,
                                    }) => (
                                        <a
                                            key={title}
                                            href={to}
                                            className={`group flex flex-col items-center gap-3 rounded-3xl p-8 text-center transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 ${className}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <IconTile icon={icon} />
                                                <span className="rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white">
                                                    {tag}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-bold">
                                                {title}
                                            </h3>
                                            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                                                {description}
                                            </p>
                                        </a>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Импорт — Редактирование — Экспорт */}
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <div className="mb-12 flex flex-col items-center gap-3 text-center">
                        <h2 className="text-4xl font-bold sm:text-5xl">
                            Импорт — Редактирование — Экспорт ✨
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Готовы начать?
                        </p>
                    </div>
                    <div className="grid gap-x-16 gap-y-12 md:grid-cols-2">
                        {WORKFLOW_ITEMS.map(
                            ({
                                icon,
                                title,
                                description,
                                tag,
                                tagClassName,
                            }) => (
                                <div key={title} className="flex gap-5">
                                    <IconTile icon={icon} />
                                    <div className="flex flex-col items-start gap-3">
                                        <h3 className="text-2xl font-bold">
                                            {title}
                                        </h3>
                                        <p className="text-lg text-muted-foreground">
                                            {description}
                                        </p>
                                        <span
                                            className={`rounded-full px-4 py-1 text-sm font-semibold ${tagClassName}`}
                                        >
                                            {tag}
                                        </span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* 5. Поддержка БД */}
                <div
                    id="databases"
                    className="mx-auto w-full max-w-5xl scroll-mt-14 px-6 pb-20"
                >
                    <div className="mb-10 flex flex-col items-center gap-4 text-center">
                        <SectionPill>БД</SectionPill>
                        <h2 className="text-4xl font-bold sm:text-5xl">
                            Поддержка
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Проектируйте под свою базу данных
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                        {DIALECTS.map(({ name, type }) => (
                            <div
                                key={name}
                                className="flex flex-col items-center gap-3 rounded-3xl border bg-card p-6 shadow-sm"
                            >
                                <span className="flex size-20 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                                    <img
                                        src={databaseLogoMap[type]}
                                        alt=""
                                        className="max-h-full max-w-full object-contain"
                                    />
                                </span>
                                <span className="text-xl font-semibold">
                                    {name}
                                </span>
                                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="size-2.5 rounded-full bg-green-500" />
                                    Готово
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Free/Pro */}
                <div className="mx-auto max-w-3xl px-6 pb-14 text-center">
                    <h2 className="mb-2 text-2xl font-bold">Free и Pro</h2>
                    <p className="mb-4 text-muted-foreground">
                        На Free доступно 3 сохранённые диаграммы, на Pro — без
                        ограничений.
                    </p>
                    <Button asChild variant="outline">
                        {/* /plans живёт вне SPA (на sql-platform, basename /tools/erd2 не применяется) — Link дал бы неверный /tools/erd2/plans */}
                        <a href="/plans">Тарифы</a>
                    </Button>
                </div>

                {/* FAQ */}
                <div className="mx-auto max-w-2xl px-6 pb-14">
                    <h2 className="mb-4 text-center text-2xl font-bold">
                        Частые вопросы
                    </h2>
                    <Accordion type="single" collapsible>
                        {FAQ_ITEMS.map(({ question, answer }, index) => (
                            <AccordionItem
                                key={question}
                                value={`faq-${index}`}
                            >
                                <AccordionTrigger className="text-left">
                                    {question}
                                </AccordionTrigger>
                                <AccordionContent>{answer}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {/* Финальный CTA */}
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-20 text-center">
                    <h2 className="text-2xl font-bold">Готовы начать?</h2>
                    <Button asChild size="lg">
                        <Link to="/">Открыть редактор</Link>
                    </Button>
                </div>

                {/* 6. Футер */}
                <footer className="border-t">
                    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
                        {FOOTER_COLUMNS.map(({ title, links }) => (
                            <div key={title} className="flex flex-col gap-3">
                                <h3 className="text-base font-bold">{title}</h3>
                                <ul className="flex flex-col gap-2.5">
                                    {links.map(({ label, href }) => (
                                        <li key={label}>
                                            <a
                                                href={href}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                {label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="border-t px-6 py-5 text-center text-sm text-muted-foreground">
                        © 2026 SQL Lab
                    </div>
                </footer>
            </section>
        </>
    );
};

export const AboutPage: React.FC = () => (
    <LocalConfigProvider>
        <StorageProvider>
            <ThemeProvider>
                <AboutPageComponent />
            </ThemeProvider>
        </StorageProvider>
    </LocalConfigProvider>
);
