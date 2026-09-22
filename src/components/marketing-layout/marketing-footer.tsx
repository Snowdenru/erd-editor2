import React from 'react';

const FOOTER_COLUMNS: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
}> = [
    {
        title: 'Продукт',
        links: [
            { label: 'Цены', href: '/tools/erd2/pricing' },
            { label: 'Общий тариф Pro (с курсами)', href: '/plans' },
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

export const MarketingFooter: React.FC = () => (
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
);
