import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
        ).toHaveAttribute('href', '/tools/erd2');
    });

    it('footer links "Цены" to the ERD pricing page', () => {
        wrap(<MarketingFooter />);

        expect(screen.getByRole('link', { name: 'Цены' })).toHaveAttribute(
            'href',
            '/tools/erd2/pricing'
        );
        expect(screen.getByText(/© 2026 SQL Lab/)).toBeInTheDocument();
    });
});
