import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as account from '@/lib/sqllab-account';
import * as auth from '@/lib/sqllab-auth';
import { AccountMenu } from '../account-menu';

const assign = vi.fn();
const openOpenDiagramDialog = vi.fn();

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({ openOpenDiagramDialog }),
}));

const renderMenu = () =>
    render(
        <MemoryRouter basename="/tools/erd2" initialEntries={['/tools/erd2/']}>
            <AccountMenu />
        </MemoryRouter>
    );

describe('AccountMenu', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        openOpenDiagramDialog.mockClear();
        assign.mockClear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                pathname: '/tools/erd2/',
                search: '',
                assign,
            },
        });
    });

    it('shows an invitation to log in for an anonymous user, no menu', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderMenu();

        expect(screen.getByText('Войти')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Войти'));
        expect(assign).toHaveBeenCalledWith(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2F'
        );
    });

    it('shows the profile name once loaded for a logged-in user, and opens the menu on click', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchProfile').mockResolvedValue({
            full_name: 'Denis S',
            email: 'den@example.com',
        });
        renderMenu();

        await waitFor(() =>
            expect(screen.getByText('Denis S')).toBeInTheDocument()
        );

        fireEvent.pointerDown(screen.getByText('Denis S'));
        expect(screen.getByText('den@example.com')).toBeInTheDocument();
    });

    it('"Мои схемы" opens the existing open-diagram dialog', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchProfile').mockResolvedValue({
            full_name: 'Denis S',
            email: 'den@example.com',
        });
        renderMenu();
        await waitFor(() =>
            expect(screen.getByText('Denis S')).toBeInTheDocument()
        );
        fireEvent.pointerDown(screen.getByText('Denis S'));

        fireEvent.click(screen.getByText('Мои схемы'));

        expect(openOpenDiagramDialog).toHaveBeenCalledTimes(1);
    });

    it('the placeholder items are disabled and marked "Скоро"', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchProfile').mockResolvedValue({
            full_name: 'Denis S',
            email: 'den@example.com',
        });
        renderMenu();
        await waitFor(() =>
            expect(screen.getByText('Denis S')).toBeInTheDocument()
        );
        fireEvent.pointerDown(screen.getByText('Denis S'));

        expect(
            screen
                .getByText('Ссылка для встраивания')
                .closest('[role="menuitem"]')
        ).toHaveAttribute('data-disabled');
        expect(
            screen
                .getByText('Пригласить в команду')
                .closest('[role="menuitem"]')
        ).toHaveAttribute('data-disabled');
        expect(screen.getAllByText('Скоро')).toHaveLength(2);
    });

    it('"Тарифы" links to /pricing and "Поддержка" to /profile', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchProfile').mockResolvedValue({
            full_name: 'Denis S',
            email: 'den@example.com',
        });
        renderMenu();
        await waitFor(() =>
            expect(screen.getByText('Denis S')).toBeInTheDocument()
        );
        fireEvent.pointerDown(screen.getByText('Denis S'));

        expect(
            screen.getByRole('menuitem', { name: 'Тарифы' })
        ).toHaveAttribute('href', '/tools/erd2/pricing');
        expect(
            screen.getByRole('menuitem', { name: 'Поддержка' })
        ).toHaveAttribute('href', '/profile');
    });

    it('"Выйти" logs out and redirects to the app root', async () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        vi.spyOn(account, 'fetchProfile').mockResolvedValue({
            full_name: 'Denis S',
            email: 'den@example.com',
        });
        const logoutSpy = vi.spyOn(auth, 'logout').mockResolvedValue(undefined);
        renderMenu();
        await waitFor(() =>
            expect(screen.getByText('Denis S')).toBeInTheDocument()
        );
        fireEvent.pointerDown(screen.getByText('Denis S'));

        fireEvent.click(screen.getByText('Выйти'));

        await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
        expect(assign).toHaveBeenCalledWith('/tools/erd2/');
    });
});
