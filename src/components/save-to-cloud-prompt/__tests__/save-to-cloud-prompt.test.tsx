import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import * as account from '@/lib/sqllab-account';
import { SaveToCloudPrompt } from '../save-to-cloud-prompt';

const renderWithTables = (count: number) =>
    render(
        <chartDBContext.Provider
            value={
                {
                    currentDiagram: {
                        tables: Array.from({ length: count }, (_, i) => ({
                            id: `t${i}`,
                        })),
                    },
                } as never
            }
        >
            <SaveToCloudPrompt />
        </chartDBContext.Provider>
    );

describe('SaveToCloudPrompt', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('is hidden for logged-in users', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        renderWithTables(5);
        expect(screen.queryByText(/сохраните схему в облаке/i)).toBeNull();
    });

    it('appears for an anonymous user once the diagram has 3 tables', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderWithTables(3);
        expect(
            screen.getByText(/сохраните схему в облаке/i)
        ).toBeInTheDocument();
    });

    it('does not appear for an anonymous user with fewer tables before 2 minutes', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderWithTables(2);
        expect(screen.queryByText(/сохраните схему в облаке/i)).toBeNull();
    });

    it('appears after 2 minutes if the diagram has at least one table', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        renderWithTables(1);
        act(() => {
            vi.advanceTimersByTime(120_000);
        });
        expect(
            screen.getByText(/сохраните схему в облаке/i)
        ).toBeInTheDocument();
    });

    it('stays hidden for a week after the user dismisses it', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        const first = renderWithTables(3);
        fireEvent.click(screen.getByRole('button', { name: /позже/i }));
        expect(screen.queryByText(/сохраните схему в облаке/i)).toBeNull();
        first.unmount();

        renderWithTables(3);
        expect(screen.queryByText(/сохраните схему в облаке/i)).toBeNull();
    });
});
