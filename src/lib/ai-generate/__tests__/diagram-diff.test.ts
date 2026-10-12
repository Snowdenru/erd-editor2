import { describe, expect, it } from 'vitest';
import { diffDiagrams } from '../diagram-diff';
import { diagram, field, relationship, table } from './fixtures';

describe('diffDiagrams', () => {
    it('is empty for identical schemas', () => {
        const t = table('users', [field('id'), field('email')]);
        expect(diffDiagrams(diagram([t]), diagram([t])).isEmpty).toBe(true);
    });

    it('reports added and removed tables, ignoring case', () => {
        const before = diagram([
            table('Users', [field('id')]),
            table('old', [field('id')]),
        ]);
        const after = diagram([
            table('users', [field('id')]),
            table('reviews', [field('id'), field('text')]),
        ]);
        const diff = diffDiagrams(before, after);
        const byName = Object.fromEntries(
            diff.tables.map((t) => [t.name, t.status])
        );
        expect(byName).toEqual({ reviews: 'added', old: 'removed' });
        expect(diff.tables.find((t) => t.name === 'reviews')?.fieldCount).toBe(
            2
        );
        expect(diff.isEmpty).toBe(false);
    });

    it('reports added, removed and changed fields', () => {
        const before = diagram([
            table('users', [
                field('id'),
                field('legacy'),
                field('email', {
                    nullable: true,
                    type: { id: 'text', name: 'text' },
                }),
            ]),
        ]);
        const after = diagram([
            table('users', [
                field('id'),
                field('created_at'),
                field('email', {
                    nullable: false,
                    unique: true,
                    type: { id: 'varchar', name: 'varchar' },
                }),
            ]),
        ]);
        const [users] = diffDiagrams(before, after).tables;
        expect(users.status).toBe('changed');
        expect(users.addedFields).toEqual(['created_at']);
        expect(users.removedFields).toEqual(['legacy']);
        expect(users.changedFields).toEqual([
            {
                name: 'email',
                changes: [
                    'тип: text → varchar',
                    'NULL → NOT NULL',
                    'добавлен UNIQUE',
                ],
            },
        ]);
    });

    it('reports index changes by column set', () => {
        const a = field('a');
        const b = field('b');
        const withIdx = (name: string, ids: string[]) =>
            table('t', [a, b], {
                indexes: [
                    {
                        id: `i-${name}`,
                        name,
                        unique: false,
                        fieldIds: ids,
                        createdAt: 1,
                    },
                ],
            });
        const diff = diffDiagrams(
            diagram([withIdx('idx_a', [a.id])]),
            diagram([withIdx('idx_b', [b.id])])
        );
        expect(diff.tables[0].addedIndexes).toEqual(['idx_b']);
        expect(diff.tables[0].removedIndexes).toEqual(['idx_a']);
        // то же имя колонок — тот же индекс, но переименование видно
        const renamed = diffDiagrams(
            diagram([withIdx('idx_a', [a.id])]),
            diagram([withIdx('renamed', [a.id])])
        );
        expect(renamed.tables[0].addedIndexes).toEqual([]);
        expect(renamed.tables[0].removedIndexes).toEqual([]);
        expect(renamed.tables[0].otherChanges).toEqual([
            'индекс idx_a → renamed',
        ]);
    });

    it('reports added and removed relationships with readable labels', () => {
        const users = table('users', [field('id')]);
        const orders = table('orders', [field('id'), field('user_id')]);
        const items = table('items', [field('id'), field('order_id')]);
        const before = diagram(
            [users, orders],
            [relationship(orders, 'user_id', users, 'id')]
        );
        const after = diagram(
            [users, orders, items],
            [relationship(items, 'order_id', orders, 'id')]
        );
        const diff = diffDiagrams(before, after);
        expect(diff.addedRelationships).toEqual(['items.order_id → orders.id']);
        expect(diff.removedRelationships).toEqual([
            'orders.user_id → users.id',
        ]);
    });

    it('ignores views, many-to-many and relationships that touch views', () => {
        const users = table('users', [field('id')]);
        const tags = table('tags', [field('id')]);
        const view = table('v_users', [field('id')], { isView: true });
        const rels = [
            relationship(users, 'id', tags, 'id', {
                sourceCardinality: 'many',
                targetCardinality: 'many',
            }),
            relationship(view, 'id', users, 'id'),
        ];
        const full = diagram([users, tags, view], rels);
        const bare = diagram([users, tags]);
        expect(diffDiagrams(full, bare).isEmpty).toBe(true);
        expect(diffDiagrams(bare, full).isEmpty).toBe(true);
    });

    it('treats a reversed foreign key and int/integer as the same schema', () => {
        const users = table('users', [field('id', { primaryKey: true })]);
        const orders = table('orders', [field('user_id')]);
        const before = diagram(
            [users, orders],
            [relationship(orders, 'user_id', users, 'id')]
        );
        const after = diagram(
            [
                table('users', [
                    field('id', {
                        primaryKey: true,
                        type: { id: 'int', name: 'INT' },
                    }),
                ]),
                orders,
            ],
            [
                relationship(users, 'id', orders, 'user_id', {
                    sourceCardinality: 'one',
                    targetCardinality: 'many',
                }),
            ]
        );
        expect(diffDiagrams(before, after).isEmpty).toBe(true);
    });
});
