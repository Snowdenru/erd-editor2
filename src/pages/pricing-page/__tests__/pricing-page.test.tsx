import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import * as account from '@/lib/sqllab-account';
import { PricingPage } from '../pricing-page';

const plan: account.ErdPlan = {
    id: 7,
    name: 'ERD Pro',
    price: '290.00',
    duration_days: 30,
    price_7d: '149.00',
    duration_days_7d: 7,
    price_3m: '690.00',
    duration_days_3m: 91,
    price_yearly: '2490.00',
    duration_days_yearly: 365,
};

const assign = vi.fn();

const renderAt = (url: string) =>
    render(
        <HelmetProvider>
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={[`/tools/erd2${url}`]}
            >
                <PricingPage />
            </MemoryRouter>
        </HelmetProvider>
    );

describe('PricingPage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        assign.mockClear();
        sessionStorage.clear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                pathname: '/tools/erd2/pricing',
                search: '',
                assign,
            },
        });
        vi.spyOn(account, 'fetchErdPlan').mockResolvedValue(plan);
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        vi.spyOn(account, 'fetchLimits').mockResolvedValue({
            tier: 'free',
            max_tables: 10,
            max_cloud_diagrams: 3,
            cloud_diagrams_used: 0,
        });
    });

    it('shows the four terms with prices from the plan and preselects 12 months', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderAt('/pricing');

        expect(await screen.findByText('149 ₽')).toBeInTheDocument();
        expect(screen.getByText('290 ₽')).toBeInTheDocument();
        expect(screen.getByText('690 ₽')).toBeInTheDocument();
        expect(screen.getByText('2 490 ₽')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /войти и оплатить/i })
        ).toBeInTheDocument();
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_pricing_view',
            expect.any(String),
            expect.anything()
        );
    });

    it('sends an anonymous user to login and comes back to the chosen term', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderAt('/pricing');
        await screen.findByText('149 ₽');

        fireEvent.click(screen.getByRole('radio', { name: /3 месяца/i }));
        fireEvent.click(
            screen.getByRole('button', { name: /войти и оплатить/i })
        );

        expect(assign).toHaveBeenCalledWith(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2Fpricing%3Fplan%3D3m'
        );
    });

    it('starts a payment for a logged-in user and redirects to the payment page', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        const pay = vi
            .spyOn(account, 'initiatePayment')
            .mockResolvedValue('https://yookassa.ru/pay/1');
        renderAt('/pricing');
        await screen.findByText('149 ₽');

        fireEvent.click(screen.getByRole('button', { name: /оплатить/i }));

        await waitFor(() =>
            expect(pay).toHaveBeenCalledWith(
                7,
                '12m',
                '/tools/erd2/pricing?payment=success'
            )
        );
        await waitFor(() =>
            expect(assign).toHaveBeenCalledWith('https://yookassa.ru/pay/1')
        );
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_checkout_start',
            expect.any(String),
            { period: '12m' }
        );
    });

    it('starts the payment automatically after login when ?plan is present', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        const pay = vi
            .spyOn(account, 'initiatePayment')
            .mockResolvedValue('https://yookassa.ru/pay/2');
        renderAt('/pricing?plan=1m');

        await waitFor(() =>
            expect(pay).toHaveBeenCalledWith(
                7,
                '1m',
                '/tools/erd2/pricing?payment=success'
            )
        );
    });

    it('shows the success banner after returning from payment', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        renderAt('/pricing?payment=success');

        expect(await screen.findByText(/оплата прошла/i)).toBeInTheDocument();
    });

    it('shows an error with a retry button when the plan cannot be loaded', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        vi.spyOn(account, 'fetchErdPlan').mockRejectedValue(
            new Error('offline')
        );
        renderAt('/pricing');

        expect(
            await screen.findByText(/не удалось загрузить тарифы/i)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /повторить/i })
        ).toBeInTheDocument();
    });
});
