import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { DdlLivePreview } from '../ddl-live-preview';
import { DatabaseType } from '@/lib/domain/database-type';
import { i18n } from '@/i18n/i18n';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBField } from '@/lib/domain/db-field';

function buildTable(
    overrides: Partial<DBTable> & { id: string; name: string }
): DBTable {
    return {
        x: 0,
        y: 0,
        fields: [],
        indexes: [],
        color: '#000000',
        isView: false,
        createdAt: Date.now(),
        ...overrides,
    };
}

function buildField(
    overrides: Partial<DBField> & { id: string; name: string }
): DBField {
    return {
        type: { id: 'text', name: 'text' },
        primaryKey: false,
        unique: false,
        nullable: true,
        createdAt: Date.now(),
        ...overrides,
    };
}

function buildDiagram(
    tables: DBTable[],
    relationships: DBRelationship[] = []
): Diagram {
    return {
        id: 'd1',
        name: 'Test',
        databaseType: DatabaseType.POSTGRESQL,
        tables,
        relationships,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe('DdlLivePreview', () => {
    it('shows the empty placeholder when diagram is undefined', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <DdlLivePreview diagram={undefined} />
            </I18nextProvider>
        );
        expect(
            screen.getByTestId('ddl-live-preview-empty')
        ).toBeInTheDocument();
    });

    it('shows the empty placeholder when the diagram has zero tables', () => {
        render(
            <I18nextProvider i18n={i18n}>
                <DdlLivePreview diagram={buildDiagram([])} />
            </I18nextProvider>
        );
        expect(
            screen.getByTestId('ddl-live-preview-empty')
        ).toBeInTheDocument();
    });

    it('renders one card per table and one line per relationship, with PK/FK badges', () => {
        const usersTable = buildTable({
            id: 'users',
            name: 'users',
            x: 0,
            y: 0,
            fields: [
                buildField({
                    id: 'users_id',
                    name: 'id',
                    primaryKey: true,
                    unique: true,
                    nullable: false,
                }),
            ],
        });
        const ordersTable = buildTable({
            id: 'orders',
            name: 'orders',
            x: 400,
            y: 0,
            fields: [buildField({ id: 'orders_user_id', name: 'user_id' })],
        });
        const relationship: DBRelationship = {
            id: 'rel1',
            name: 'users_orders',
            sourceTableId: 'orders',
            targetTableId: 'users',
            sourceFieldId: 'orders_user_id',
            targetFieldId: 'users_id',
            sourceCardinality: 'many',
            targetCardinality: 'one',
            createdAt: Date.now(),
        };

        render(
            <I18nextProvider i18n={i18n}>
                <DdlLivePreview
                    diagram={buildDiagram(
                        [usersTable, ordersTable],
                        [relationship]
                    )}
                />
            </I18nextProvider>
        );

        expect(screen.getAllByTestId('ddl-live-preview-table')).toHaveLength(2);
        expect(
            screen.getAllByTestId('ddl-live-preview-relationship')
        ).toHaveLength(1);
        expect(screen.getByText('users')).toBeInTheDocument();
        expect(screen.getByText('orders')).toBeInTheDocument();
        expect(screen.getByText('id (PK)')).toBeInTheDocument();
        expect(screen.getByText('user_id (FK)')).toBeInTheDocument();
    });

    it('caps visible fields at 5 and shows a "+N ещё" row', () => {
        const fields = Array.from({ length: 7 }).map((_, index) =>
            buildField({ id: `f${index}`, name: `field_${index}` })
        );
        const table = buildTable({ id: 't1', name: 'wide_table', fields });

        render(
            <I18nextProvider i18n={i18n}>
                <DdlLivePreview diagram={buildDiagram([table])} />
            </I18nextProvider>
        );

        expect(screen.getByText('field_0')).toBeInTheDocument();
        expect(screen.getByText('field_4')).toBeInTheDocument();
        expect(screen.queryByText('field_5')).not.toBeInTheDocument();
        expect(screen.getByText('+2 ещё')).toBeInTheDocument();
    });

    it('does not crash when a relationship references a missing table id', () => {
        const table = buildTable({ id: 't1', name: 'solo' });
        const relationship: DBRelationship = {
            id: 'rel1',
            name: 'broken',
            sourceTableId: 'missing',
            targetTableId: 't1',
            sourceFieldId: 'a',
            targetFieldId: 'b',
            sourceCardinality: 'many',
            targetCardinality: 'one',
            createdAt: Date.now(),
        };

        render(
            <I18nextProvider i18n={i18n}>
                <DdlLivePreview
                    diagram={buildDiagram([table], [relationship])}
                />
            </I18nextProvider>
        );

        expect(screen.getAllByTestId('ddl-live-preview-table')).toHaveLength(1);
        expect(
            screen.queryByTestId('ddl-live-preview-relationship')
        ).not.toBeInTheDocument();
    });
});
