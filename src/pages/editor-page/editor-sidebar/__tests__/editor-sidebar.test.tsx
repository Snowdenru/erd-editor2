import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n/i18n';
import { DatabaseType } from '@/lib/domain/database-type';
import { SidebarProvider } from '@/components/sidebar/sidebar';

// Основная гарантия этого изменения: клик по кнопке «Новая» в сайдбаре
// создаёт пустую диаграмму напрямую (createEmptyDiagram), а не открывает
// принудительную модалку выбора БД (openCreateDiagramDialog).

const mockCreateEmptyDiagram = vi.fn().mockResolvedValue(undefined);
const mockOpenOpenDiagramDialog = vi.fn();
const mockOpenCreateDiagramDialog = vi.fn();

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

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({
        databaseType: DatabaseType.POSTGRESQL,
    }),
}));

vi.mock('@/hooks/use-layout', () => ({
    useLayout: () => ({
        selectSidebarSection: vi.fn(),
        selectedSidebarSection: undefined,
        showSidePanel: vi.fn(),
        selectVisualsTab: vi.fn(),
    }),
}));

import { EditorSidebar } from '../editor-sidebar';

describe('EditorSidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateEmptyDiagram.mockResolvedValue(undefined);
    });

    it('calls createEmptyDiagram (not the forced dialog) when "New" is clicked', () => {
        render(
            <SidebarProvider>
                <EditorSidebar />
            </SidebarProvider>
        );

        const buttons = screen.getAllByRole('button');
        // Первая кнопка в сайдбаре — «Новая» (diagramItems[0], иконка Plus).
        fireEvent.click(buttons[0]);

        expect(mockCreateEmptyDiagram).toHaveBeenCalledTimes(1);
        expect(mockOpenCreateDiagramDialog).not.toHaveBeenCalled();
        expect(mockOpenOpenDiagramDialog).not.toHaveBeenCalled();
    });
});
