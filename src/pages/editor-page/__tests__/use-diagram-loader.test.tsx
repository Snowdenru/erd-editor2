import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// Основная гарантия этого изменения: на пустом аккаунте (0 диаграмм)
// загрузчик создаёт пустую диаграмму напрямую (createEmptyDiagram),
// а не открывает принудительную модалку выбора БД (openCreateDiagramDialog).

const mockLoadDiagram = vi.fn();
const mockResetRedoStack = vi.fn();
const mockResetUndoStack = vi.fn();
const mockShowLoader = vi.fn();
const mockHideLoader = vi.fn();
const mockOpenOpenDiagramDialog = vi.fn();
const mockOpenCreateDiagramDialog = vi.fn();
const mockCreateEmptyDiagram = vi.fn().mockResolvedValue(undefined);
const mockListDiagrams = vi.fn();
const mockConfig: { defaultDiagramId: string | undefined } = {
    defaultDiagramId: undefined,
};

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({
        loadDiagram: mockLoadDiagram,
        // Умышленно отличается от diagramId (undefined — параметра в URL
        // нет), иначе эффект в useDiagramLoader сработает на условие
        // "currentDiagram?.id === diagramId" (undefined === undefined) и
        // выйдет раньше, чем дойдёт до ветки создания пустой диаграммы.
        currentDiagram: { id: 'some-other-diagram' },
    }),
}));

vi.mock('@/hooks/use-config', () => ({
    useConfig: () => ({
        config: mockConfig,
    }),
}));

vi.mock('@/hooks/use-create-empty-diagram', () => ({
    useCreateEmptyDiagram: () => ({
        createEmptyDiagram: mockCreateEmptyDiagram,
    }),
}));

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        openOpenDiagramDialog: mockOpenOpenDiagramDialog,
        openCreateDiagramDialog: mockOpenCreateDiagramDialog,
    }),
}));

vi.mock('@/hooks/use-full-screen-spinner', () => ({
    useFullScreenLoader: () => ({
        showLoader: mockShowLoader,
        hideLoader: mockHideLoader,
    }),
}));

vi.mock('@/hooks/use-redo-undo-stack', () => ({
    useRedoUndoStack: () => ({
        resetRedoStack: mockResetRedoStack,
        resetUndoStack: mockResetUndoStack,
    }),
}));

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        listDiagrams: mockListDiagrams,
    }),
}));

import { useDiagramLoader } from '../use-diagram-loader';

describe('useDiagramLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConfig.defaultDiagramId = undefined;
        mockCreateEmptyDiagram.mockResolvedValue(undefined);
        mockListDiagrams.mockResolvedValue([]);
    });

    it('creates an empty diagram (not the forced dialog) when there are no existing diagrams and no diagramId in the URL', async () => {
        renderHook(() => useDiagramLoader(), {
            wrapper: ({ children }) => (
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/']}
                >
                    {children}
                </MemoryRouter>
            ),
        });

        await waitFor(() => {
            expect(mockCreateEmptyDiagram).toHaveBeenCalledTimes(1);
        });

        expect(mockOpenCreateDiagramDialog).not.toHaveBeenCalled();
        expect(mockOpenOpenDiagramDialog).not.toHaveBeenCalled();
    });

    let currentPath = '';
    const LocationProbe = () => {
        currentPath = useLocation().pathname;
        return null;
    };

    const renderAt = (url: string) =>
        renderHook(() => useDiagramLoader(), {
            wrapper: ({ children }) => (
                <MemoryRouter basename="/tools/erd2" initialEntries={[url]}>
                    <LocationProbe />
                    <Routes>
                        <Route path="new" element={<>{children}</>} />
                        <Route
                            path="d/:diagramId"
                            element={<div data-testid="diagram-route" />}
                        />
                    </Routes>
                </MemoryRouter>
            ),
        });

    it('обычный /new: пустой холст через createEmptyDiagram с reuseEmptyLast', async () => {
        mockConfig.defaultDiagramId = 'default-1';
        mockLoadDiagram.mockResolvedValue({ id: 'default-1' });
        mockListDiagrams.mockResolvedValue([{ id: 'default-1' }]);

        renderAt('/tools/erd2/new');

        // Решение «переиспользовать или создать» принимает сам хук createEmptyDiagram
        // (покрыт его тестами); загрузчик лишь передаёт опции.
        await waitFor(() =>
            expect(mockCreateEmptyDiagram).toHaveBeenCalledWith({
                replace: true,
                reuseEmptyLast: true,
            })
        );
        expect(mockOpenOpenDiagramDialog).not.toHaveBeenCalled();
        expect(mockLoadDiagram).not.toHaveBeenCalled();
    });

    it.each(['/tools/erd2/new?open=import', '/tools/erd2/new?tab=ddl'])(
        '%s с глубокой ссылкой не создаёт пустую схему, а открывает схему по умолчанию',
        async (url) => {
            mockConfig.defaultDiagramId = 'default-1';
            mockLoadDiagram.mockResolvedValue({ id: 'default-1' });
            mockListDiagrams.mockResolvedValue([{ id: 'default-1' }]);

            renderAt(url);

            await waitFor(() => expect(currentPath).toBe('/d/default-1'));
            expect(mockLoadDiagram).toHaveBeenCalledWith('default-1');
            expect(mockCreateEmptyDiagram).not.toHaveBeenCalled();
        }
    );

    it('/new?open=import без схем создаёт пустую схему обычным путём (без reuse)', async () => {
        mockListDiagrams.mockResolvedValue([]);

        renderAt('/tools/erd2/new?open=import');

        await waitFor(() =>
            expect(mockCreateEmptyDiagram).toHaveBeenCalledTimes(1)
        );
        expect(mockCreateEmptyDiagram).toHaveBeenCalledWith();
    });
});
