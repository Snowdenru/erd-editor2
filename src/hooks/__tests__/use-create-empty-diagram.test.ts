import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddDiagram = vi.fn();
const mockListDiagrams = vi.fn();
const mockUpdateConfig = vi.fn();
const mockNavigate = vi.fn();
const mockListTables = vi.fn();
const mockConfig: { defaultDiagramId: string | undefined } = {
    defaultDiagramId: undefined,
};

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        addDiagram: mockAddDiagram,
        listDiagrams: mockListDiagrams,
        listTables: mockListTables,
    }),
}));

vi.mock('@/hooks/use-config', () => ({
    useConfig: () => ({
        config: mockConfig,
        updateConfig: mockUpdateConfig,
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

import { useCreateEmptyDiagram } from '../use-create-empty-diagram';

describe('useCreateEmptyDiagram', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListDiagrams.mockResolvedValue([]);
        mockListTables.mockResolvedValue([]);
        mockConfig.defaultDiagramId = undefined;
    });

    it('creates a PostgreSQL diagram, saves it, sets it as default and navigates to it', async () => {
        const { result } = renderHook(() => useCreateEmptyDiagram());

        await act(async () => {
            await result.current.createEmptyDiagram();
        });

        expect(mockAddDiagram).toHaveBeenCalledWith(
            expect.objectContaining({
                diagram: expect.objectContaining({
                    databaseType: 'postgresql',
                    name: 'Diagram 1',
                }),
            })
        );

        const savedDiagram = mockAddDiagram.mock.calls[0][0].diagram;
        expect(mockUpdateConfig).toHaveBeenCalledWith({
            config: { defaultDiagramId: savedDiagram.id },
        });
        expect(mockNavigate).toHaveBeenCalledWith(`/d/${savedDiagram.id}`);
    });

    it('с replace: true заменяет запись истории', async () => {
        const { result } = renderHook(() => useCreateEmptyDiagram());
        await act(async () => {
            await result.current.createEmptyDiagram({ replace: true });
        });
        const saved = mockAddDiagram.mock.calls[0][0].diagram;
        expect(mockNavigate).toHaveBeenCalledWith(`/d/${saved.id}`, {
            replace: true,
        });
    });

    it('numbers the diagram after the count of existing diagrams', async () => {
        mockListDiagrams.mockResolvedValue([{}, {}]);
        const { result } = renderHook(() => useCreateEmptyDiagram());

        await act(async () => {
            await result.current.createEmptyDiagram();
        });

        expect(mockAddDiagram).toHaveBeenCalledWith(
            expect.objectContaining({
                diagram: expect.objectContaining({ name: 'Diagram 3' }),
            })
        );
    });

    describe('reuseEmptyLast', () => {
        beforeEach(() => {
            mockConfig.defaultDiagramId = 'last';
            mockListDiagrams.mockResolvedValue([{ id: 'last' }]);
        });

        it('открывает пустую последнюю схему вместо создания новой', async () => {
            mockListTables.mockResolvedValue([]);
            const { result } = renderHook(() => useCreateEmptyDiagram());
            await act(async () => {
                await result.current.createEmptyDiagram({
                    replace: true,
                    reuseEmptyLast: true,
                });
            });
            expect(mockAddDiagram).not.toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/d/last', {
                replace: true,
            });
        });

        it('создаёт новую, если в последней схеме есть таблицы', async () => {
            mockListTables.mockResolvedValue([{ id: 't1' }]);
            const { result } = renderHook(() => useCreateEmptyDiagram());
            await act(async () => {
                await result.current.createEmptyDiagram({
                    replace: true,
                    reuseEmptyLast: true,
                });
            });
            expect(mockAddDiagram).toHaveBeenCalledTimes(1);
            const saved = mockAddDiagram.mock.calls[0][0].diagram;
            expect(mockNavigate).toHaveBeenCalledWith(`/d/${saved.id}`, {
                replace: true,
            });
        });

        it('без reuseEmptyLast создаёт новую, даже если последняя пустая', async () => {
            mockListTables.mockResolvedValue([]);
            const { result } = renderHook(() => useCreateEmptyDiagram());
            await act(async () => {
                await result.current.createEmptyDiagram();
            });
            expect(mockAddDiagram).toHaveBeenCalledTimes(1);
        });
    });
});
