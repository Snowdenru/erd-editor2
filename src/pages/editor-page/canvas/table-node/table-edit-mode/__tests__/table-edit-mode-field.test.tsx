import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n/i18n';
import { TooltipProvider } from '@/components/tooltip/tooltip';
import { DatabaseType } from '@/lib/domain/database-type';
import type { DBField, DBTable } from '@/lib/domain';
import { TableEditModeField } from '../table-edit-mode-field';

vi.mock('@/hooks/use-update-table-field', () => ({
    useUpdateTableField: () => ({
        dataFieldOptions: [],
        handleDataTypeChange: vi.fn(),
        handlePrimaryKeyToggle: vi.fn(),
        handleNullableToggle: vi.fn(),
        handleNameChange: vi.fn(),
        generateFieldSuffix: () => '',
        fieldName: 'email',
        nullable: true,
        primaryKey: false,
        removeField: vi.fn(),
    }),
}));

const field = {
    id: 'f1',
    name: 'email',
    type: { id: 'text', name: 'text' },
} as unknown as DBField;
const table = { id: 't1', fields: [field] } as unknown as DBTable;

const renderField = (onEnter?: (id: string) => void) =>
    render(
        <TooltipProvider>
            <TableEditModeField
                table={table}
                field={field}
                databaseType={DatabaseType.POSTGRESQL}
                onEnter={onEnter}
            />
        </TooltipProvider>
    );

describe('TableEditModeField: Enter в имени колонки', () => {
    it('вызывает onEnter с id колонки', () => {
        const onEnter = vi.fn();
        renderField(onEnter);
        fireEvent.keyDown(screen.getByDisplayValue('email'), {
            key: 'Enter',
        });
        expect(onEnter).toHaveBeenCalledWith('f1');
    });

    it('другие клавиши onEnter не вызывают', () => {
        const onEnter = vi.fn();
        renderField(onEnter);
        fireEvent.keyDown(screen.getByDisplayValue('email'), { key: 'a' });
        expect(onEnter).not.toHaveBeenCalled();
    });
});
