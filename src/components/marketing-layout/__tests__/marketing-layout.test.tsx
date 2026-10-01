import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ThemeProvider } from '@/context/theme-context/theme-provider';
import { MarketingHeader } from '../marketing-header';
import { MarketingFooter } from '../marketing-footer';

const wrap = (ui: React.ReactNode) =>
    render(
        <LocalConfigProvider>
            <ThemeProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/pricing']}
                >
                    {ui}
                </MemoryRouter>
            </ThemeProvider>
        </LocalConfigProvider>
    );

describe('marketing layout', () => {
    it('header links "Цены" to the ERD pricing page and "Изучать SQL" to courses', () => {
        wrap(<MarketingHeader />);

        expect(screen.getByRole('link', { name: 'Цены' })).toHaveAttribute(
            'href',
            '/tools/erd2/pricing'
        );
        expect(
            screen.getByRole('link', { name: /изучать sql/i })
        ).toHaveAttribute('href', '/courses');
        expect(
            screen.getByRole('link', { name: /открыть редактор/i })
        ).toHaveAttribute('href', '/tools/erd2/diagrams');
    });

    it('footer links "Цены" to the ERD pricing page', () => {
        wrap(<MarketingFooter />);

        expect(screen.getByRole('link', { name: 'Цены' })).toHaveAttribute(
            'href',
            '/tools/erd2/pricing'
        );
        expect(screen.getByText(/© 2026 SQL Lab/)).toBeInTheDocument();
    });

    it('footer import link opens the import dialog', () => {
        wrap(<MarketingFooter />);

        expect(
            screen.getByRole('link', { name: 'Импорт из вашей БД' })
        ).toHaveAttribute('href', '/tools/erd2/new?open=import');
    });

    describe('hash links smooth scroll', () => {
        afterEach(() => {
            document.getElementById('databases')?.remove();
            window.history.pushState({}, '', '/');
        });

        const setup = (path: string) => {
            window.history.pushState({}, '', path);
            const target = document.createElement('div');
            target.id = 'databases';
            document.body.appendChild(target);
            const scrollIntoView = vi.fn();
            Element.prototype.scrollIntoView = scrollIntoView;
            wrap(<MarketingHeader />);
            return scrollIntoView;
        };

        it('on the about page scrolls smoothly without reload', () => {
            const scrollIntoView = setup('/tools/erd2/about');
            const notPrevented = fireEvent.click(
                screen.getByRole('link', { name: 'Поддержка БД' })
            );

            expect(notPrevented).toBe(false);
            expect(scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start',
            });
            expect(window.location.hash).toBe('#databases');
            expect(window.location.pathname).toBe('/tools/erd2/about');
        });

        it.each([
            ['ctrl', { ctrlKey: true }],
            ['meta', { metaKey: true }],
            ['shift', { shiftKey: true }],
            ['alt', { altKey: true }],
            ['middle button', { button: 1 }],
        ])('ignores %s click so the browser handles it', (_name, init) => {
            const scrollIntoView = setup('/tools/erd2/about');
            const notPrevented = fireEvent.click(
                screen.getByRole('link', { name: 'Поддержка БД' }),
                init
            );

            expect(notPrevented).toBe(true);
            expect(scrollIntoView).not.toHaveBeenCalled();
        });

        it('keeps the current history.state when pushing the hash', () => {
            const state = { usr: null, key: 'abc', idx: 3 };
            setup('/tools/erd2/about');
            window.history.replaceState(state, '');
            fireEvent.click(screen.getByRole('link', { name: 'Поддержка БД' }));

            expect(window.history.state).toEqual(state);
            expect(window.location.hash).toBe('#databases');
        });

        it('on other pages keeps normal navigation', () => {
            const scrollIntoView = setup('/tools/erd2/pricing');
            const notPrevented = fireEvent.click(
                screen.getByRole('link', { name: 'Поддержка БД' })
            );

            expect(notPrevented).toBe(true);
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });
});
