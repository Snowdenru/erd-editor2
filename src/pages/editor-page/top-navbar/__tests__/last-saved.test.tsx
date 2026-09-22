import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import * as account from '@/lib/sqllab-account';
import { emitSyncStatus } from '@/lib/sync-status-events';
import * as syncEvents from '@/lib/sync-status-events';
import { LastSaved } from '../last-saved';
import { TooltipProvider } from '@/components/tooltip/tooltip';
import type { Diagram } from '@/lib/domain/diagram';
import { DatabaseType } from '@/lib/domain/database-type';

const diagram: Diagram = {
    id: 'diagram-1',
    name: 'Test',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const renderLastSaved = () =>
    render(
        <TooltipProvider>
            <chartDBContext.Provider
                value={{ currentDiagram: diagram } as never}
            >
                <LastSaved />
            </chartDBContext.Provider>
        </TooltipProvider>
    );

describe('LastSaved', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('opens the login prompt instead of syncing when an anonymous user clicks it', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        const emitSpy = vi.spyOn(syncEvents, 'emitSyncNow');
        renderLastSaved();

        fireEvent.click(screen.getByRole('button'));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(emitSpy).not.toHaveBeenCalled();
    });

    it('triggers an immediate sync when a logged-in user clicks it', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        const emitSpy = vi.spyOn(syncEvents, 'emitSyncNow');
        renderLastSaved();

        fireEvent.click(screen.getByRole('button'));

        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows a spinner while syncing and reverts once idle', () => {
        renderLastSaved();

        act(() => emitSyncStatus('syncing'));
        expect(document.querySelector('.animate-spin')).not.toBeNull();

        act(() => emitSyncStatus('idle'));
        expect(document.querySelector('.animate-spin')).toBeNull();
    });
});
