import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    it('closes the dialog and clones the example on click', () => {
        render(<ExampleDiagramsInline />);

        fireEvent.click(screen.getByText('Employees schema'));

        expect(mockCloseCreateDiagramDialog).toHaveBeenCalled();
        expect(mockUtilizeExample).toHaveBeenCalledWith({
            example: expect.objectContaining({ id: '1' }),
        });
    });

    it('links to the full templates library', () => {
        render(<ExampleDiagramsInline />);
        const link = screen.getByText('Больше шаблонов →', {
            selector: 'a',
        });
        expect(link).toHaveAttribute('href', '/templates');
    });
});
