import { describe, expect, it } from 'vitest';
import { MIN_TABLE_SIZE } from '@/lib/domain/db-table';
import {
    mergeAiDiagram,
    NEW_TABLE_GAP,
    NEW_TABLE_ROWS,
    NEW_TABLE_ROW_STEP,
} from '../merge-diagram';
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
        expect(merged.updatedAt).toBeInstanceOf(Date);
        expect(merged.updatedAt).not.toBe(current.updatedAt);
        expect(merged.updatedAt.getTime()).toBeGreaterThan(
            current.updatedAt.getTime()
        );
    });

    it('does not give two proposed tables with the same name the same id', () => {
        const current = diagram([
            table('users', [field('id')], { id: 'old', x: 50, y: 60 }),
        ]);
        const proposed = diagram([
            table('users', [field('id')], { id: 'p1' }),
            table('Users ', [field('id')], { id: 'p2' }),
        ]);
        const merged = mergeAiDiagram(current, proposed);
        const [first, second] = merged.tables!;
        expect(new Set(merged.tables!.map((t) => t.id)).size).toBe(2);
        expect(first).toMatchObject({ id: 'old', x: 50, y: 60 });
        expect(second.id).toBe('p2');
        expect(second.x).toBeGreaterThanOrEqual(50 + MIN_TABLE_SIZE);
    });

    it('does not give two same-named fields of a matched table the same id', () => {
        const current = diagram([
            table('t', [field('a', { id: 'old-a' })], { id: 'T' }),
        ]);
        const proposed = diagram([
            table('t', [
                field('a', { id: 'p-a1' }),
                field('A', { id: 'p-a2' }),
            ]),
        ]);
        const fields = mergeAiDiagram(current, proposed).tables![0].fields;
        expect(fields.map((f) => f.id)).toEqual(['old-a', 'p-a2']);
    });

    it('drops dependencies of removed tables and keeps the rest', () => {
        const dep = (
            id: string,
            tableId: string,
            dependentTableId: string
        ) => ({
            id,
            tableId,
            dependentTableId,
            createdAt: 1,
        });
        const current = diagram(
            [
                table('a', [field('id')], { id: 'A' }),
                table('b', [field('id')], { id: 'B' }),
                table('gone', [field('id')], { id: 'G' }),
            ],
            [],
            {
                dependencies: [
                    dep('d1', 'A', 'B'),
                    dep('d2', 'G', 'A'),
                    dep('d3', 'B', 'G'),
                ],
            }
        );
        const merged = mergeAiDiagram(
            current,
            diagram([table('a', [field('id')]), table('b', [field('id')])])
        );
        expect(merged.dependencies!.map((d) => d.id)).toEqual(['d1']);
    });

    it('remaps index fieldIds when a matched field id changes', () => {
        const current = diagram([
            table('t', [field('a', { id: 'old-f' })], { id: 'T' }),
        ]);
        const proposed = diagram([
            table('t', [field('a', { id: 'new-f' })], {
                indexes: [
                    {
                        id: 'ix',
                        name: 'i',
                        unique: false,
                        fieldIds: ['new-f'],
                        createdAt: 1,
                    },
                ],
            }),
        ]);
        const merged = mergeAiDiagram(current, proposed);
        expect(merged.tables![0].indexes[0].fieldIds).toEqual(['old-f']);
    });

    it('drops a relationship whose endpoint cannot be mapped', () => {
        const a = table('a', [field('id')]);
        const b = table('b', [field('id')]);
        const proposed = diagram([a, b], [relationship(a, 'id', b, 'id')]);
        proposed.relationships![0].targetFieldId = 'missing';
        const merged = mergeAiDiagram(diagram([]), proposed);
        expect(merged.relationships).toEqual([]);
    });

    it('wraps new tables into a second column after NEW_TABLE_ROWS rows', () => {
        const current = diagram([
            table('base', [field('id')], { x: 10, y: 30, width: 200 }),
        ]);
        const names = ['base', 'n1', 'n2', 'n3', 'n4', 'n5'];
        const merged = mergeAiDiagram(
            current,
            diagram(names.map((n) => table(n, [field('id')])))
        );
        const fresh = merged.tables!.slice(1);
        const x0 = 10 + 200 + NEW_TABLE_GAP;
        expect(fresh.map((t) => [t.x, t.y])).toEqual([
            [x0, 30],
            [x0, 30 + NEW_TABLE_ROW_STEP],
            [x0, 30 + 2 * NEW_TABLE_ROW_STEP],
            [x0, 30 + 3 * NEW_TABLE_ROW_STEP],
            [x0 + MIN_TABLE_SIZE + NEW_TABLE_GAP, 30],
        ]);
        expect(NEW_TABLE_ROWS).toBe(4);
    });
});
