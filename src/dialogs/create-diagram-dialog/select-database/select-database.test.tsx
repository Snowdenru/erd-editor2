import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@/i18n/i18n';
import { DatabaseType } from '@/lib/domain/database-type';
import * as aiEvents from '@/lib/ai-generate/events';

const closeCreate = vi.fn();
vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({
        openImportDiagramDialog: vi.fn(),
        closeCreateDiagramDialog: closeCreate,
    }),
}));
vi.mock('../select-database-content', () => ({
    SelectDatabaseContent: () => null,
}));
vi.mock('@/components/dialog/dialog', async () => {
    const R = await import('react');
    const Pass = ({ children }: { children?: React.ReactNode }) =>
        R.createElement('div', null, children);
    return {
        DialogClose: Pass,
        DialogDescription: Pass,
        DialogFooter: Pass,
        DialogHeader: Pass,
        DialogInternalContent: Pass,
        DialogTitle: Pass,
    };
});

import { SelectDatabase } from './select-database';

const renderIt = (databaseType: DatabaseType) =>
    render(
        <SelectDatabase
            onContinue={vi.fn()}
            databaseType={databaseType}
            setDatabaseType={vi.fn()}
            hasExistingDiagram={true}
            createNewDiagram={vi.fn()}
        />
    );

beforeEach(() => vi.restoreAllMocks());

describe('SelectDatabase AI entry', () => {
    it('closes the dialog and opens AI generation with the chosen dialect', () => {
        const emit = vi
            .spyOn(aiEvents, 'emitOpenAiGenerate')
            .mockImplementation(() => undefined);
        renderIt(DatabaseType.MYSQL);
        fireEvent.click(screen.getByText('Создать с ИИ'));
        expect(closeCreate).toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith({
            source: 'create_dialog',
            dialect: 'mysql',
        });
    });

    it('stays enabled for the generic database type', () => {
        renderIt(DatabaseType.GENERIC);
        expect(
            screen.getByText('Создать с ИИ').closest('button')
        ).toBeEnabled();
    });
});
