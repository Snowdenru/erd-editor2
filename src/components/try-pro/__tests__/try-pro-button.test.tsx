import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as account from '@/lib/sqllab-account';
import type { ErdLimits } from '@/lib/sqllab-account';
import { TryProButton } from '../try-pro-button';

const renderButton = () =>
    render(
        <MemoryRouter basename="/tools/erd2" initialEntries={['/tools/erd2/']}>
            <TryProButton />
        </MemoryRouter>
    );

describe('TryProButton', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
    });

    it('renders the button, no dialog until clicked', () => {
        renderButton();
        expect(screen.getByText('Улучшить до Pro')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the dialog with three benefits and tracks the click', () => {
        renderButton();
        fireEvent.click(screen.getByText('Улучшить до Pro'));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Расширьте возможности')).toBeInTheDocument();
        expect(screen.getByText(/схем в облаке/i)).toBeInTheDocument();
        expect(screen.getByText(/таблиц в схеме/i)).toBeInTheDocument();
        expect(screen.getByText(/общий pro/i)).toBeInTheDocument();
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_try_pro_click',
            expect.any(String)
        );
    });

    it('the CTA links to /pricing and closes the dialog on click', () => {
        renderButton();
        fireEvent.click(screen.getByText('Улучшить до Pro'));

        const cta = screen.getByRole('link', { name: /смотреть тарифы/i });
        expect(cta).toHaveAttribute('href', '/tools/erd2/pricing');

        fireEvent.click(cta);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows nothing while the tier of a logged-in user is still loading', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchLimits').mockReturnValue(
            new Promise<ErdLimits>(() => undefined)
        );
        renderButton();
        expect(screen.queryByText('Улучшить до Pro')).toBeNull();
        expect(screen.queryByText(/активен/)).toBeNull();
    });

    it('shows an "ERD Pro активен" badge instead of the upsell for ERD Pro subscribers', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchLimits').mockResolvedValue({
            tier: 'erd',
            max_tables: 200,
            max_cloud_diagrams: null,
            cloud_diagrams_used: 0,
        });
        renderButton();

        await waitFor(() =>
            expect(screen.getByText('ERD Pro активен')).toBeInTheDocument()
        );
        expect(screen.queryByText('Улучшить до Pro')).toBeNull();
        expect(
            screen.getByRole('link', { name: /erd pro активен/i })
        ).toHaveAttribute('href', '/tools/erd2/pricing');
    });

    it('shows a "Pro активен" badge instead of the upsell for platform Pro subscribers', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchLimits').mockResolvedValue({
            tier: 'pro',
            max_tables: 200,
            max_cloud_diagrams: null,
            cloud_diagrams_used: 0,
        });
        renderButton();

        await waitFor(() =>
            expect(screen.getByText('Pro активен')).toBeInTheDocument()
        );
        expect(screen.queryByText('Улучшить до Pro')).toBeNull();
    });

    it('falls back to the free-tier upsell if fetching the tier fails', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchLimits').mockRejectedValue(
            new Error('network')
        );
        renderButton();

        await waitFor(() =>
            expect(screen.getByText('Улучшить до Pro')).toBeInTheDocument()
        );
    });
});
