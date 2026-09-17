import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/i18n/i18n';

const mockCreateTable = vi.fn();
const mockOpenCreateDiagramDialog = vi.fn();

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({
        createTable: mockCreateTable,
    }),
}));

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        openCreateDiagramDialog: mockOpenCreateDiagramDialog,
    }),
}));

vi.mock('@/hooks/use-example-diagrams', () => ({
    useExampleDiagrams: () => ({
        examples: [],
        loadingExampleId: undefined,
        utilizeExample: vi.fn(),
    }),
}));

import { CanvasEmptyState } from '../canvas-empty-state';

describe('CanvasEmptyState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens the create-diagram dialog when "import from database" is clicked', () => {
        render(
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={['/tools/erd2/diagrams/x']}
            >
                <CanvasEmptyState />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Импорт из вашей БД'));

        expect(mockOpenCreateDiagramDialog).toHaveBeenCalled();
    });

    it('creates an empty table when "new table" is clicked', () => {
        render(
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={['/tools/erd2/diagrams/x']}
            >
                <CanvasEmptyState />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Новая таблица'));

        expect(mockCreateTable).toHaveBeenCalledWith();
    });
});
