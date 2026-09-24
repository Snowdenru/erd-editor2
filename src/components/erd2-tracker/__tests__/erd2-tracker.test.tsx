import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import { Erd2Tracker } from '../erd2-tracker';

let mockDiagram = {
    id: 'd1',
    name: 'X',
    databaseType: 'postgresql',
    tables: [] as unknown[],
    relationships: [] as unknown[],
};
let mockDiagramId = 'd1';

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({
        diagramId: mockDiagramId,
        currentDiagram: mockDiagram,
    }),
}));

const setDiagram = (tables: number, relations = 0, id = 'd1') => {
    mockDiagramId = id;
    mockDiagram = {
        ...mockDiagram,
        id,
        tables: Array.from({ length: tables }, (_, i) => ({
            id: `t${i}`,
            fields: [{ id: 'f' }],
        })),
        relationships: Array.from({ length: relations }, (_, i) => ({
            id: `r${i}`,
        })),
    };
};

const types = () => vi.mocked(account.trackEvent).mock.calls.map((c) => c[0]);
const actionTypes = () =>
    vi
        .mocked(account.trackEvent)
        .mock.calls.filter((c) => c[0] === 'erd2_action')
        .map((c) => (c[2] as { type: string }).type);

describe('Erd2Tracker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        sessionStorage.clear();
        setDiagram(0);
    });
    afterEach(() => vi.useRealTimers());

    it('sends erd2_open once with the source and cloud flag', () => {
        const { rerender } = render(<Erd2Tracker />);
        rerender(<Erd2Tracker />);
        const opens = vi
            .mocked(account.trackEvent)
            .mock.calls.filter((c) => c[0] === 'erd2_open');
        expect(opens).toHaveLength(1);
        expect(opens[0][2]).toEqual({ source: 'direct', is_cloud: false });
    });

    it('does not count the initial load of a diagram as an action', () => {
        setDiagram(5, 3);
        render(<Erd2Tracker />);
        expect(types()).not.toContain('erd2_action');
    });

    it('reports a table added after the initial load', () => {
        const { rerender } = render(<Erd2Tracker />);
        setDiagram(1);
        rerender(<Erd2Tracker />);
        expect(actionTypes()).toEqual(['table_add']);
    });

    it('does not report a diagram switch as an action', () => {
        const { rerender } = render(<Erd2Tracker />);
        setDiagram(7, 2, 'd2');
        rerender(<Erd2Tracker />);
        expect(actionTypes()).toEqual([]);
    });

    it('sends an engaged pulse only after recent user activity', () => {
        render(<Erd2Tracker />);
        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(types()).not.toContain('erd2_engaged');

        act(() => {
            window.dispatchEvent(new Event('pointerdown'));
            vi.advanceTimersByTime(30_000);
        });
        const pulse = vi
            .mocked(account.trackEvent)
            .mock.calls.find((c) => c[0] === 'erd2_engaged');
        expect(pulse?.[2]).toEqual({ seconds: 30, is_cloud: false });
    });

    it('does not send a snapshot for an empty diagram', () => {
        render(<Erd2Tracker />);
        act(() => {
            vi.advanceTimersByTime(5 * 60_000);
        });
        expect(types()).not.toContain('erd2_schema_snapshot');
    });

    it('sends a numeric snapshot every five minutes for a non-empty diagram', () => {
        setDiagram(2, 1);
        render(<Erd2Tracker />);
        act(() => {
            vi.advanceTimersByTime(5 * 60_000);
        });
        const snap = vi
            .mocked(account.trackEvent)
            .mock.calls.find((c) => c[0] === 'erd2_schema_snapshot');
        expect(snap?.[2]).toMatchObject({
            tables: 2,
            relations: 1,
            fields: 2,
            is_cloud: false,
        });
    });
});
