import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddDiagram = vi.fn();
const mockListDiagrams = vi.fn();
const mockUpdateConfig = vi.fn();
const mockNavigate = vi.fn();
const mockGetDiagram = vi.fn();
const mockConfig: { defaultDiagramId: string | undefined } = {
    defaultDiagramId: undefined,
};

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        addDiagram: mockAddDiagram,
        listDiagrams: mockListDiagrams,
        getDiagram: mockGetDiagram,
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
        mockGetDiagram.mockResolvedValue(undefined);
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
        const emptyDiagram = {
            id: 'last',
            tables: [],
            relationships: [],
            areas: [],
            notes: [],
            customTypes: [],
            dependencies: [],
        };
        const run = async () => {
            const { result } = renderHook(() => useCreateEmptyDiagram());
            await act(async () => {
                await result.current.createEmptyDiagram({
                    replace: true,
                    reuseEmptyLast: true,
                });
            });
        };
        const expectCreatedNew = () => {
            expect(mockAddDiagram).toHaveBeenCalledTimes(1);
            const saved = mockAddDiagram.mock.calls[0][0].diagram;
            expect(mockNavigate).toHaveBeenCalledWith(`/d/${saved.id}`, {
                replace: true,
            });
        };

        beforeEach(() => {
            mockConfig.defaultDiagramId = 'last';
            mockListDiagrams.mockResolvedValue([{ id: 'last' }]);
            mockGetDiagram.mockResolvedValue(emptyDiagram);
        });

        it('открывает полностью пустую последнюю схему вместо создания новой', async () => {
            await run();
            expect(mockAddDiagram).not.toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/d/last', {
                replace: true,
            });
            expect(mockListDiagrams).not.toHaveBeenCalled();
        });

        it('запрашивает схему со всеми дочерними сущностями', async () => {
            await run();
            expect(mockGetDiagram).toHaveBeenCalledWith('last', {
                includeTables: true,
                includeRelationships: true,
                includeDependencies: true,
                includeAreas: true,
                includeCustomTypes: true,
                includeNotes: true,
            });
        });

        it.each([
            ['таблицы', { tables: [{ id: 't1' }] }],
            ['связи', { relationships: [{ id: 'r1' }] }],
            ['область', { areas: [{ id: 'a1' }] }],
            ['заметка', { notes: [{ id: 'n1' }] }],
            ['кастомный тип', { customTypes: [{ id: 'c1' }] }],
            ['зависимость', { dependencies: [{ id: 'd1' }] }],
        ])(
            'создаёт новую, если в последней схеме есть %s',
            async (_n, extra) => {
                mockGetDiagram.mockResolvedValue({ ...emptyDiagram, ...extra });
                await run();
                expectCreatedNew();
            }
        );

        it('создаёт новую, если последней схемы нет в хранилище', async () => {
            mockGetDiagram.mockResolvedValue(undefined);
            await run();
            expectCreatedNew();
        });

        it('без reuseEmptyLast создаёт новую, даже если последняя пустая', async () => {
            const { result } = renderHook(() => useCreateEmptyDiagram());
            await act(async () => {
                await result.current.createEmptyDiagram();
            });
            expect(mockAddDiagram).toHaveBeenCalledTimes(1);
        });
    });
});
