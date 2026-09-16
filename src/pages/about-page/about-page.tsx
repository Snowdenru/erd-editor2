import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ChartDBLogo from '@/assets/sqllab-logo-light.svg';
import ChartDBDarkLogo from '@/assets/sqllab-logo-dark.svg';
import { useTheme } from '@/hooks/use-theme';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ThemeProvider } from '@/context/theme-context/theme-provider';
import { Button } from '@/components/button/button';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/card/card';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/accordion/accordion';
import {
    Code2,
    Search,
    Undo2,
    Zap,
    LayoutTemplate,
    Download,
    Sparkles,
} from 'lucide-react';

const DIALECTS = [
    'PostgreSQL',
    'MySQL',
    'MariaDB',
    'SQLite',
    'SQL Server',
    'Oracle',
    'CockroachDB',
    'ClickHouse',
];

const FEATURES: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}> = [
    {
        icon: Code2,
        title: 'Редактор drag & drop',
        description:
            'Перетаскивайте таблицы, настраивайте связи и типы полей мышью прямо на холсте.',
    },
    {
        icon: Search,
        title: 'Поиск и фильтр по схеме',
        description:
            'Быстро находите нужную таблицу в большой схеме — фильтр таблиц на холсте.',
    },
    {
        icon: Code2,
        title: 'DBML как живой редактор',
        description:
            'DBML — не только формат экспорта: можно редактировать схему прямо в виде DBML-кода.',
    },
    {
        icon: Undo2,
        title: 'Undo/redo',
        description: 'Отменяйте и повторяйте любые изменения на холсте.',
    },
    {
        icon: Zap,
        title: 'Автоматическая раскладка',
        description:
            'Один клик — и редактор сам аккуратно расставляет таблицы на холсте.',
    },
    {
        icon: LayoutTemplate,
        title: 'Готовые примеры и шаблоны',
        description:
            'Начните с классических учебных баз (Employees, Bike Stores, DVD Rental) или выберите из 52 готовых схем реальных проектов.',
    },
];

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
    {
        question: 'Подключается ли ERD2 напрямую к моей базе данных?',
        answer: 'Нет. Вы либо вставляете готовый DDL/DBML, либо запускаете предложенный SQL-скрипт в своей базе и вставляете результат сюда — прямого доступа к вашей базе инструмент не запрашивает.',
    },
    {
        question: 'Как быстрее всего начать?',
        answer: 'Нажмите «Импорт из вашей БД», выберите тип базы и вставьте DDL или DBML — или начните с одного из готовых примеров либо из 52 шаблонов.',
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
            <section className="flex w-screen flex-col bg-background">
                <nav className="flex h-12 shrink-0 flex-row items-center justify-between border-b px-4">
                    <div className="flex flex-1 justify-start gap-x-3">
                        <div className="flex items-center font-primary">
                            <a
                                href="https://sqllab.ru"
                                className="cursor-pointer"
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
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-10 pt-16 text-center">
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                        Визуализируйте свою базу данных
                    </h1>
                    <p className="max-w-xl text-lg text-muted-foreground">
                        Бесплатный онлайн-редактор ER-диаграмм: вставьте DDL или
                        SQL-запрос — получите готовую схему за секунды.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                        <Button asChild size="lg">
                            <a href="/tools/erd2/">Открыть редактор</a>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <Link to="/templates">Смотреть шаблоны</Link>
                        </Button>
                    </div>
                </div>

                {/* Импорт */}
                <div className="mx-auto max-w-4xl px-6 pb-14">
                    <h2 className="mb-2 text-center text-2xl font-bold">
                        Вставьте SQL — получите диаграмму
                    </h2>
                    <p className="mx-auto mb-6 max-w-2xl text-center text-muted-foreground">
                        DDL, DBML или результат SQL-запроса к вашей базе — схема
                        строится сразу, живой предпросмотр обновляется по мере
                        ввода.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {DIALECTS.map((dialect) => (
                            <span
                                key={dialect}
                                className="rounded-full border px-3 py-1 text-sm text-muted-foreground"
                            >
                                {dialect}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Фичи */}
                <div className="mx-auto max-w-5xl px-6 pb-14">
                    <h2 className="mb-6 text-center text-2xl font-bold">
                        Всё что нужно для проектирования БД
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map(({ icon: Icon, title, description }) => (
                            <Card key={title}>
                                <CardHeader>
                                    <Icon className="mb-2 size-6 text-primary" />
                                    <CardTitle className="text-base">
                                        {title}
                                    </CardTitle>
                                    <CardDescription>
                                        {description}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Экспорт */}
                <div className="mx-auto max-w-3xl px-6 pb-14 text-center">
                    <Download className="mx-auto mb-2 size-6 text-primary" />
                    <h2 className="mb-2 text-2xl font-bold">
                        Экспорт в готовом виде
                    </h2>
                    <p className="text-muted-foreground">
                        SVG, PNG, SQL DDL, DBML и JSON — забирайте схему в том
                        формате, который нужен для документации или миграции.
                    </p>
                </div>

                {/* Free/Pro */}
                <div className="mx-auto max-w-3xl px-6 pb-14 text-center">
                    <Sparkles className="mx-auto mb-2 size-6 text-primary" />
                    <h2 className="mb-2 text-2xl font-bold">Free и Pro</h2>
                    <p className="mb-4 text-muted-foreground">
                        На Free доступно 3 сохранённые диаграммы, на Pro — без
                        ограничений.
                    </p>
                    <Button asChild variant="outline">
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
                                <AccordionTrigger>{question}</AccordionTrigger>
                                <AccordionContent>{answer}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {/* Финальный CTA */}
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 pb-20 text-center">
                    <h2 className="text-2xl font-bold">Готовы начать?</h2>
                    <Button asChild size="lg">
                        <a href="/tools/erd2/">Открыть редактор</a>
                    </Button>
                </div>
            </section>
        </>
    );
};

export const AboutPage: React.FC = () => (
    <LocalConfigProvider>
        <ThemeProvider>
            <AboutPageComponent />
        </ThemeProvider>
    </LocalConfigProvider>
);
