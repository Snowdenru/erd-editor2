import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { emitUpgradeWall } from '@/lib/upgrade-wall-events';
import * as account from '@/lib/sqllab-account';
import { UpgradeWallHost } from '../upgrade-wall-host';

const renderHost = () =>
    render(
        <MemoryRouter basename="/tools/erd2" initialEntries={['/tools/erd2/']}>
            <UpgradeWallHost />
        </MemoryRouter>
    );

describe('UpgradeWallHost', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        sessionStorage.clear();
    });

    it('shows nothing until a wall event arrives', () => {
        renderHost();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('explains the cloud diagram limit and links to pricing', () => {
        renderHost();
        act(() => emitUpgradeWall({ reason: 'diagram_limit', limit: 3 }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/лимит схем в облаке/i)).toBeInTheDocument();
        expect(screen.getByText(/3/)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /смотреть тарифы/i })
        ).toHaveAttribute('href', '/tools/erd2/pricing');
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_wall_view',
            expect.any(String),
            { reason: 'diagram_limit', limit: 3 }
        );
    });

    it('explains the table limit', () => {
        renderHost();
        act(() => emitUpgradeWall({ reason: 'table_limit', limit: 10 }));

        expect(
            screen.getByText(/в схеме больше 10 таблиц/i)
        ).toBeInTheDocument();
    });

    it('does not reopen the dialog for a reason the user already dismissed this session', () => {
        renderHost();
        act(() => emitUpgradeWall({ reason: 'table_limit', limit: 10 }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Пользователь закрывает диалог кнопкой «Позже».
        act(() => screen.getByRole('button', { name: /позже/i }).click());
        expect(screen.queryByRole('dialog')).toBeNull();

        // Фоновая синхронизация повторяет попытку и снова ловит тот же 403.
        act(() => emitUpgradeWall({ reason: 'table_limit', limit: 10 }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(account.trackEvent).toHaveBeenCalledTimes(1);
    });

    it('still shows a different reason after another reason was dismissed', () => {
        renderHost();
        act(() => emitUpgradeWall({ reason: 'table_limit', limit: 10 }));
        act(() => screen.getByRole('button', { name: /позже/i }).click());
        expect(screen.queryByRole('dialog')).toBeNull();

        act(() => emitUpgradeWall({ reason: 'diagram_limit', limit: 3 }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/лимит схем в облаке/i)).toBeInTheDocument();
        expect(account.trackEvent).toHaveBeenCalledTimes(2);
    });
});
