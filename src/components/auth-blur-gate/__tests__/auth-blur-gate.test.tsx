import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import { AuthBlurGate } from '../auth-blur-gate';

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
});

describe('AuthBlurGate', () => {
    it('renders children unmodified for a logged-in user', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);

        render(
            <AuthBlurGate>
                <div>secret sql</div>
            </AuthBlurGate>
        );

        expect(screen.getByText('secret sql')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /войти/i })).toBeNull();
    });

    it('renders children (blurred) plus a login button for an anonymous user', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);

        render(
            <AuthBlurGate>
                <div>secret sql</div>
            </AuthBlurGate>
        );

        expect(screen.getByText('secret sql')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /войти/i })
        ).toBeInTheDocument();
    });

    it('navigates straight to login (no dialog) on click, with the current path as return path', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);

        render(
            <AuthBlurGate>
                <div>secret sql</div>
            </AuthBlurGate>
        );
        fireEvent.click(screen.getByRole('button', { name: /войти/i }));

        expect(assign).toHaveBeenCalledWith(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2Fdiagrams%2Fabc'
        );
    });
});
