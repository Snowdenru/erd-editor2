import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as account from '@/lib/sqllab-account';
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
});
