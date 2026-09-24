import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBTable } from '@/lib/domain/db-table';

export const makeField = (
    over: Partial<DBField> & { id: string; name: string }
): DBField =>
    ({
        type: { id: 'integer', name: 'integer' },
        primaryKey: false,
        unique: false,
        nullable: true,
        createdAt: 0,
        ...over,
    }) as DBField;

export const makeTable = (
    over: Partial<DBTable> & { id: string; name: string }
): DBTable => ({
    x: 0,
    y: 0,
    fields: [],
    indexes: [],
    color: '#ffffff',
    isView: false,
    createdAt: 0,
    ...over,
});

export const makeDiagram = (over: Partial<Diagram> = {}): Diagram => ({
    id: 'd1',
    name: 'Shop',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
});

export const makeIndex = (over: {
    id: string;
    name: string;
    fieldIds: string[];
    unique?: boolean;
}): DBTable['indexes'][number] =>
    ({ unique: false, createdAt: 0, ...over }) as DBTable['indexes'][number];

// users(id PK, email unique «Почта») 1 — N orders(id PK, user_id NOT NULL)
export const shopDiagram = (): Diagram =>
    makeDiagram({
        tables: [
            makeTable({
                id: 't-users',
                name: 'users',
                comments: 'Покупатели',
                fields: [
                    makeField({
                        id: 'u-id',
                        name: 'id',
                        primaryKey: true,
                        nullable: false,
                    }),
                    makeField({
                        id: 'u-email',
                        name: 'email',
                        type: { id: 'varchar', name: 'varchar' },
                        characterMaximumLength: '255',
                        unique: true,
                        comments: 'Почта',
                    }),
                ],
            }),
            makeTable({
                id: 't-orders',
                name: 'orders',
                fields: [
                    makeField({
                        id: 'o-id',
                        name: 'id',
                        primaryKey: true,
                        nullable: false,
                    }),
                    makeField({
                        id: 'o-user',
                        name: 'user_id',
                        nullable: false,
                        default: '0',
                    }),
                ],
            }),
        ],
        relationships: [
            {
                id: 'r1',
                name: 'fk_orders_users',
                sourceTableId: 't-users',
                targetTableId: 't-orders',
                sourceFieldId: 'u-id',
                targetFieldId: 'o-user',
                sourceCardinality: 'one',
                targetCardinality: 'many',
                createdAt: 0,
            },
        ],
    });
