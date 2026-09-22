import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import { LoginPromptDialog } from '../login-prompt-dialog';

const assign = vi.fn();

beforeEach(() => {
    vi.restoreAllMocks();
    assign.mockClear();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...window.location,
            pathname: '/tools/erd2/diagrams/abc',
            search: '',
            assign,
        },
    });
    vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
});

describe('LoginPromptDialog', () => {
    it('for export explains that export is free after login and goes to login with the current page as return path', () => {
        render(
            <LoginPromptDialog
                open
                onOpenChange={() => undefined}
                reason="export"
            />
        );

        expect(
            screen.getByText(/экспорт бесплатный после входа/i)
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /войти/i }));

        expect(assign).toHaveBeenCalledWith(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2Fdiagrams%2Fabc'
        );
    });

    it('uses an explicit return path when given', () => {
        render(
            <LoginPromptDialog
                open
                onOpenChange={() => undefined}
                reason="save_landing"
                returnPath="/tools/erd2/diagrams/xyz"
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: /войти и сохранить/i })
        );

        expect(assign).toHaveBeenCalledWith(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2Fdiagrams%2Fxyz'
        );
    });

    it('lets the user continue without login on the landing and calls onSecondary', () => {
        const onSecondary = vi.fn();
        render(
            <LoginPromptDialog
                open
                onOpenChange={() => undefined}
                reason="save_landing"
                onSecondary={onSecondary}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: /продолжить без входа/i })
        );

        expect(onSecondary).toHaveBeenCalledTimes(1);
        expect(assign).not.toHaveBeenCalled();
    });

    it('tracks that the prompt was shown', () => {
        render(
            <LoginPromptDialog
                open
                onOpenChange={() => undefined}
                reason="export"
            />
        );

        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_login_prompt',
            '/tools/erd2/diagrams/abc',
            { reason: 'export' }
        );
    });
});
