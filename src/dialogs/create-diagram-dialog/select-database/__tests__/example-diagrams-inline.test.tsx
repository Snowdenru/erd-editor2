import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Side-effect import: initializes the global i18next singleton, same as
// src/main.tsx does at app bootstrap. Without this, useTranslation() (used
// without an I18nextProvider, matching how the component is actually
// mounted in the app) has no instance to read translations from.
import '@/i18n/i18n';

const mockUtilizeExample = vi.fn();
const mockCloseCreateDiagramDialog = vi.fn();

vi.mock('@/hooks/use-example-diagrams', () => ({
    useExampleDiagrams: () => ({
        examples: [
            {
                id: '1',
                name: 'Employees schema',
                description: 'test',
                image: 'employees.png',
                imageDark: 'employees-dark.png',
                diagram: { id: 'diagramexample03' },
            },
        ],
        loadingExampleId: undefined,
        utilizeExample: mockUtilizeExample,
    }),
}));

vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        closeCreateDiagramDialog: mockCloseCreateDiagramDialog,
    }),
}));

import { ExampleDiagramsInline } from '../example-diagrams-inline';

describe('ExampleDiagramsInline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clones the example and closes the dialog once cloning succeeds', async () => {
        mockUtilizeExample.mockResolvedValue(undefined);
        render(
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={['/tools/erd2/']}
            >
                <ExampleDiagramsInline />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Employees schema'));

        expect(mockUtilizeExample).toHaveBeenCalledWith({
            example: expect.objectContaining({ id: '1' }),
        });

        await waitFor(() => {
            expect(mockCloseCreateDiagramDialog).toHaveBeenCalled();
        });
    });

    it('does not close the dialog if cloning the example fails', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockUtilizeExample.mockRejectedValue(
            new Error('storage quota exceeded')
        );
        render(
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={['/tools/erd2/']}
            >
                <ExampleDiagramsInline />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Employees schema'));

        expect(mockUtilizeExample).toHaveBeenCalledWith({
            example: expect.objectContaining({ id: '1' }),
        });

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
        expect(mockCloseCreateDiagramDialog).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it('links to the full templates library, respecting the app basename', () => {
        render(
            <MemoryRouter
                basename="/tools/erd2"
                initialEntries={['/tools/erd2/']}
            >
                <ExampleDiagramsInline />
            </MemoryRouter>
        );
        const link = screen.getByText('Больше шаблонов →', {
            selector: 'a',
        });
        expect(link).toHaveAttribute('href', '/tools/erd2/templates');
    });
});
