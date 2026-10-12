import { describe, expect, it } from 'vitest';
import { mergeAiDiagram } from '../merge-diagram';
import { diagram, field, relationship, table } from './fixtures';

describe('mergeAiDiagram', () => {
    it('keeps id, position, color and field ids of tables matched by name', () => {
        const current = diagram([
            table(
                'users',
                [field('id', { id: 'old-id', createdAt: 5 }), field('email')],
                {
                    id: 'old-users',
                    x: 120,
                    y: 340,
                    color: '#ff0000',
                    width: 300,
                    order: 2,
                    parentAreaId: 'area-1',
                    createdAt: 7,
                }
            ),
        ]);
        const proposed = diagram([
            table(
                'Users',
                [
                    field('id', { id: 'new-id', primaryKey: true }),
                    field('email', { id: 'new-email', nullable: false }),
                    field('created_at', { id: 'new-created' }),
                ],
                { id: 'new-users', x: 0, y: 0, color: '#8eb7ff' }
            ),
        ]);
        const merged = mergeAiDiagram(current, proposed);
        const users = merged.tables![0];
        expect(users).toMatchObject({
            id: 'old-users',
            x: 120,
            y: 340,
            color: '#ff0000',
            width: 300,
            order: 2,
            parentAreaId: 'area-1',
            createdAt: 7,
            name: 'Users',
        });
        expect(users.fields.map((f) => f.id)).toEqual([
            'old-id',
            current.tables![0].fields[1].id,
            'new-created',
        ]);
        expect(users.fields[0]).toMatchObject({
            primaryKey: true,
            createdAt: 5,
        });
        expect(users.fields[1].nullable).toBe(false);
    });

    it('places new tables to the right of existing ones and drops removed tables', () => {
        const current = diagram([
            table('a', [field('id')], { x: 0, y: 100, width: 224 }),
            table('gone', [field('id')], { x: 500, y: 0 }),
        ]);
        const proposed = diagram([
            table('a', [field('id')]),
            table('b', [field('id')]),
            table('c', [field('id')]),
        ]);
        const merged = mergeAiDiagram(current, proposed);
        expect(merged.tables!.map((t) => t.name)).toEqual(['a', 'b', 'c']);
        const [, b, c] = merged.tables!;
        // правый край существующих таблиц — 500 + 224 (ширина по умолчанию)
        expect(b.x).toBeGreaterThanOrEqual(500 + 224);
        expect(c.x).toBe(b.x);
        expect(c.y).toBeGreaterThan(b.y);
        expect(b.y).toBe(0);
    });

    it('remaps relationships and index field ids to the final ids', () => {
        const users = table('users', [field('id', { id: 'u-id' })], {
            id: 'u',
        });
        const current = diagram([users]);
        const pUsers = table('users', [field('id', { id: 'p-u-id' })], {
            id: 'p-u',
        });
        const pOrders = table(
            'orders',
            [
                field('id', { id: 'p-o-id' }),
                field('user_id', { id: 'p-o-user' }),
            ],
            {
                id: 'p-o',
                indexes: [
                    {
                        id: 'ix',
                        name: 'idx_user',
                        unique: false,
                        fieldIds: ['p-o-user'],
                        createdAt: 1,
                    },
                ],
            }
        );
        const proposed = diagram(
            [pUsers, pOrders],
            [relationship(pOrders, 'user_id', pUsers, 'id')]
        );
        const merged = mergeAiDiagram(current, proposed);
        const orders = merged.tables!.find((t) => t.name === 'orders')!;
        expect(orders.indexes[0].fieldIds).toEqual(['p-o-user']);
        const rel = merged.relationships![0];
        expect(rel).toMatchObject({
            sourceTableId: orders.id,
            targetTableId: 'u',
            sourceFieldId: 'p-o-user',
            targetFieldId: 'u-id',
        });
    });

    it('keeps the id and name of an existing relationship that survives', () => {
        const users = table('users', [field('id')]);
        const orders = table('orders', [field('id'), field('user_id')]);
        const existing = relationship(orders, 'user_id', users, 'id', {
            id: 'keep-me',
            name: 'my_fk',
        });
        const current = diagram([users, orders], [existing]);
        const proposed = diagram([
            table('users', [field('id')]),
            table('orders', [field('id'), field('user_id')]),
        ]);
        proposed.relationships = [
            relationship(
                proposed.tables![1],
                'user_id',
                proposed.tables![0],
                'id',
                { id: 'fresh', name: 'fk_new' }
            ),
        ];
        const merged = mergeAiDiagram(current, proposed);
        expect(merged.relationships).toHaveLength(1);
        expect(merged.relationships![0]).toMatchObject({
            id: 'keep-me',
            name: 'my_fk',
        });
    });

    it('keeps diagram-level data and database type of the current diagram', () => {
        const current = diagram([table('a', [field('id')])], [], {
            id: 'keep',
            name: 'Моя схема',
            notes: [],
            areas: [],
        });
        const merged = mergeAiDiagram(
            current,
            diagram([table('a', [field('id')])], [], {
                id: 'other',
                name: 'Proposed',
            })
        );
        expect(merged).toMatchObject({
            id: 'keep',
            name: 'Моя схема',
            databaseType: current.databaseType,
        });
        expect(merged.updatedAt.getTime()).toBeGreaterThan(0);
    });
});
