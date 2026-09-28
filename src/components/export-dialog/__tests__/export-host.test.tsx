import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import { emitOpenExport } from '@/lib/export-dialog-events';
import { ExportHost } from '../export-host';

vi.mock('../export-dialog', () => ({
    ExportDialog: ({
        open,
        initialTab,
    }: {
        open: boolean;
        initialTab?: string;
    }) => (open ? <div data-testid="export-dialog">{initialTab}</div> : null),
}));

describe('ExportHost', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
    });

    it('opens the dialog on the requested tab for a logged-in user', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ExportHost />);
        expect(screen.queryByTestId('export-dialog')).toBeNull();
        act(() => emitOpenExport('sql'));
        expect(screen.getByTestId('export-dialog').textContent).toBe('sql');
    });

    it('defaults to the image tab', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ExportHost />);
        act(() => emitOpenExport());
        expect(screen.getByTestId('export-dialog').textContent).toBe('image');
    });

    it('asks an anonymous user to sign in instead of opening the dialog', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        render(<ExportHost />);
        act(() => emitOpenExport('formats'));
        expect(screen.queryByTestId('export-dialog')).toBeNull();
        expect(
            screen.getByText('Экспорт бесплатный после входа')
        ).toBeInTheDocument();
    });
});
