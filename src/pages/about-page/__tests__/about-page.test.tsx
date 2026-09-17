import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AboutPage } from '../about-page';

describe('AboutPage', () => {
    it('renders the hero heading and primary CTA pointing at the editor root, respecting the app basename', () => {
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
            expect(link).toHaveAttribute('href', '/tools/erd2');
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

    it('links to /plans for the free/pro pricing details', () => {
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

        const plansLink = screen.getByRole('link', { name: /тарифы/i });
        expect(plansLink).toHaveAttribute('href', '/plans');
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
            expect(screen.getByText(dialect)).toBeInTheDocument();
        });
    });
});
