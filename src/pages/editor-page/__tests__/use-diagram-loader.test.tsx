import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
        config: { defaultDiagramId: undefined },
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
});
