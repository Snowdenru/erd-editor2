import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from '@testing-library/react';
import '@/i18n/i18n';

import { DDLSection } from '../ddl-section';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';

const VALID_SQL =
    'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255));';

vi.mock('@/components/code-snippet/code-snippet', () => ({
    Editor: ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (value: string | undefined) => void;
    }) => (
        <textarea
            data-testid="mock-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
    CodeSnippet: () => <div data-testid="code-snippet" />,
}));
vi.mock('@/components/auth-blur-gate/auth-blur-gate', () => ({
    AuthBlurGate: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));
vi.mock('@/context/alert-context/alert-context', () => ({
    useAlert: () => ({ showAlert: vi.fn(), closeAlert: vi.fn() }),
}));
const toast = vi.fn();
vi.mock('@/components/toast/use-toast', () => ({
    useToast: () => ({ toast }),
}));

const fitView = vi.fn();
vi.mock('@xyflow/react', () => ({ useReactFlow: () => ({ fitView }) }));

const updateDiagramData = vi.fn();
const diagram: Diagram = {
    id: 'd1',
    name: 'Test',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};
vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ currentDiagram: diagram, updateDiagramData }),
}));

const openCustom = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Свой SQL' }));
const typeAndApply = async () => {
    fireEvent.change(screen.getByTestId('mock-editor'), {
        target: { value: VALID_SQL },
    });
    const btn = screen.getByRole('button', { name: 'Применить' });
    await waitFor(() => expect(btn).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(btn);
};

describe('DDLSection', () => {
    beforeEach(() => {
        updateDiagramData.mockReset();
        fitView.mockClear();
        toast.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('при сбое записи откатывает снимок, сохраняет SQL и режим', async () => {
        updateDiagramData
            .mockRejectedValueOnce(new Error('write failed'))
            .mockResolvedValueOnce(undefined);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        render(<DDLSection />);
        openCustom();
        await typeAndApply();

        await waitFor(() => expect(updateDiagramData).toHaveBeenCalledTimes(2));
        expect(updateDiagramData.mock.calls[1][0]).toBe(diagram);
        expect(updateDiagramData.mock.calls[0][0].tables).toHaveLength(1);
        await waitFor(() => expect(toast).toHaveBeenCalled());
        expect(screen.getByTestId('mock-editor')).toHaveValue(VALID_SQL);
        expect(fitView).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('после успешной замены вызывает fitView и переключает режим', async () => {
        updateDiagramData.mockResolvedValue(undefined);
        render(<DDLSection />);
        openCustom();
        await typeAndApply();

        await waitFor(() =>
            expect(screen.getByTestId('code-snippet')).toBeInTheDocument()
        );
        await waitFor(() =>
            expect(fitView).toHaveBeenCalledWith({
                padding: 0.15,
                duration: 200,
                maxZoom: 1,
            })
        );
        expect(updateDiagramData).toHaveBeenCalledTimes(1);
    });

    it('таймер fitView чистится при размонтировании', async () => {
        updateDiagramData.mockResolvedValue(undefined);
        const { unmount } = render(<DDLSection />);
        openCustom();
        await typeAndApply();
        await waitFor(() =>
            expect(screen.getByTestId('code-snippet')).toBeInTheDocument()
        );
        unmount();
        await act(async () => {
            await new Promise((r) => setTimeout(r, 400));
        });
        expect(fitView).not.toHaveBeenCalled();
    });
});
