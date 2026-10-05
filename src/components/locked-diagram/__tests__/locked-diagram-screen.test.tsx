import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as account from '@/lib/sqllab-account';
import { setLockedCards } from '@/lib/locked-diagrams';
import { LockedDiagramScreen } from '../locked-diagram-screen';

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/d/:diagramId" element={<LockedDiagramScreen />} />
            </Routes>
        </MemoryRouter>
    );

describe('LockedDiagramScreen', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setLockedCards([]);
    });

    it('renders nothing when the diagram is not a locked card', () => {
        const { container } = renderAt('/d/open-1');
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the locked state with an upgrade link for a locked card', () => {
        const track = vi
            .spyOn(account, 'trackEvent')
            .mockImplementation(() => {});
        setLockedCards([
            {
                id: 'locked-1',
                title: 'Большая схема',
                tables: 15,
                dbType: null,
                savedAt: new Date('2026-01-01T00:00:00Z'),
            },
        ]);
        renderAt('/d/locked-1');
        expect(screen.getByText('Большая схема')).toBeTruthy();
        const link = screen.getByRole('link', { name: /Открыть с Pro/ });
        expect(link.getAttribute('href')).toBe('/pricing');
        const overlay = screen.getByTestId('locked-diagram-overlay');
        expect(overlay.parentElement).toBe(document.body);
        expect(overlay.style.pointerEvents).toBe('auto');
        expect(track).toHaveBeenCalledWith(
            'erd2_locked_card_view',
            expect.any(String),
            { tables: 15 }
        );
    });
});
