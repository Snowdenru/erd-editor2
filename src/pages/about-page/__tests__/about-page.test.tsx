import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AboutPage } from '../about-page';
import { FAQ_ITEMS } from '../faq-items';

vi.mock('@/lib/sqllab-account', () => ({ trackPageView: vi.fn() }));

describe('AboutPage', () => {
    it('renders the hero heading and primary CTA pointing at the new-diagram editor entry, respecting the app basename', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /визуализируйте свою базу данных/i,
            })
        ).toBeInTheDocument();

        const openEditorLinks = screen.getAllByRole('link', {
            name: /открыть редактор/i,
        });
        expect(openEditorLinks.length).toBeGreaterThan(0);
        openEditorLinks.forEach((link) => {
            expect(link).toHaveAttribute('href', '/tools/erd2/diagrams');
        });
    });

    it('links to the templates library respecting the app basename', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        const templatesLink = screen.getByRole('link', {
            name: /смотреть шаблоны/i,
        });
        expect(templatesLink).toHaveAttribute('href', '/tools/erd2/templates');
    });

    it('links to the ERD pricing page for the free/pro details, respecting the app basename', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        const pricingLink = screen.getByRole('link', { name: /^тарифы$/i });
        expect(pricingLink).toHaveAttribute('href', '/tools/erd2/pricing');
    });

    it('renders the FAQ section with the "does it connect to my database" question', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        expect(
            screen.getByText(
                /подключается ли erd2 напрямую к моей базе данных/i
            )
        ).toBeInTheDocument();
    });

    it('lists all 8 supported database dialects', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        // Диалекты также встречаются в кнопках блока «Вставьте DDL», поэтому ищем в секции «Поддержка»
        const databasesSection = document.getElementById('databases')!;

        [
            'PostgreSQL',
            'MySQL',
            'MariaDB',
            'SQLite',
            'SQL Server',
            'Oracle',
            'CockroachDB',
            'ClickHouse',
        ].forEach((dialect) => {
            expect(
                within(databasesSection).getByText(dialect)
            ).toBeInTheDocument();
        });
    });

    it('keeps every FAQ answer in the DOM while collapsed (hidden via class)', () => {
        render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );

        expect(FAQ_ITEMS.length).toBeGreaterThan(0);
        FAQ_ITEMS.forEach(({ answer }) => {
            const el = screen.getByText(answer);
            expect(el).toBeInTheDocument();
            const panel = el.closest('[data-state]');
            expect(panel).toHaveAttribute('data-state', 'closed');
            // Скрытие в закрытом состоянии обеспечивает Tailwind-класс (в jsdom CSS нет)
            expect(panel).toHaveClass('data-[state=closed]:hidden');
        });
    });
});
