import { describe, expect, it } from 'vitest';
import type { Diagram } from '@/lib/domain/diagram';
import { DBCustomTypeKind } from '@/lib/domain/db-custom-type';
import { diffDiagrams } from '../diagram-diff';
import { mergeAiDiagram } from '../merge-diagram';
import { diagram, field, relationship, table } from './fixtures';

const ix = (name: string, fieldIds: string[], unique = false) => ({
    id: `ix-${name}`,
    name,
    unique,
    fieldIds,
    createdAt: 1,
});

// Итог так, как его видит пользователь: слияние + дифф от текущей схемы
const run = (current: Diagram, baseline: Diagram, proposed: Diagram) => {
    const merged = mergeAiDiagram(current, proposed, baseline);
    return { merged, diff: diffDiagrams(current, merged) };
};

describe('слияние — только то, что изменил ИИ', () => {
    it('одноимённые таблицы разных схем не склеиваются', () => {
        const pub = table('users', [field('id', { id: 'pub-id' })], {
            id: 'pub',
            schema: 'public',
        });
        const auth = table(
            'users',
            [
                field('id', {
                    id: 'auth-id',
                    type: { id: 'uuid', name: 'uuid' },
                }),
            ],
            { id: 'auth', schema: 'auth' }
        );
        const current = diagram([pub, auth]);
        // импорт слепо отдаёт то же самое, ответ ИИ — без правок
        const copy = () =>
            diagram([
                { ...structuredClone(pub), id: 'x1' },
                { ...structuredClone(auth), id: 'x2' },
            ]);
        const { merged, diff } = run(current, copy(), copy());
        expect(diff.isEmpty).toBe(true);
        expect(merged.tables!.map((t) => [t.id, t.schema])).toEqual([
            ['pub', 'public'],
            ['auth', 'auth'],
        ]);
        expect(merged.tables![1].fields[0].type.name).toBe('uuid');
    });

    it('схема, которую импорт подставил сам, не мешает сопоставлению', () => {
        const current = diagram([table('users', [field('id')], { id: 'u' })]);
        const imported = () =>
            diagram([
                table('users', [field('id')], { id: 'x', schema: 'public' }),
            ]);
        const { merged, diff } = run(current, imported(), imported());
        expect(diff.isEmpty).toBe(true);
        expect(merged.tables![0].id).toBe('u');
    });

    it('шум импорта не считается правкой: тип, default, PK, потерянный импортом', () => {
        const current = diagram([
            table(
                'orders',
                [
                    field('id', {
                        id: 'id',
                        primaryKey: true,
                        unique: true,
                        nullable: false,
                    }),
                    field('price', {
                        id: 'price',
                        type: { id: 'double', name: 'double precision' },
                        default: 'now()',
                    }),
                    field('ok', {
                        id: 'ok',
                        type: { id: 'boolean', name: 'boolean' },
                        default: 'true',
                    }),
                ],
                { id: 'o' }
            ),
        ]);
        // импорт исказил экспорт: типы, default и даже потерял PK
        const lossy = () =>
            diagram([
                table('orders', [
                    field('id', { id: 'b-id', nullable: true }),
                    field('price', {
                        id: 'b-price',
                        type: { id: 'double', name: 'double' },
                        default: 'CURRENT_TIMESTAMP',
                    }),
                    field('ok', {
                        id: 'b-ok',
                        type: { id: 'tinyint', name: 'tinyint' },
                        default: 'TRUE',
                    }),
                ]),
            ]);
        const { merged, diff } = run(current, lossy(), lossy());
        expect(diff.isEmpty).toBe(true);
        expect(merged.tables![0].fields).toEqual(current.tables![0].fields);
    });

    it('настоящая правка ИИ поверх шума применяется, остальное остаётся', () => {
        const current = diagram([
            table('t', [
                field('id', { id: 'id', primaryKey: true, unique: true }),
                field('age', { id: 'age', default: '0' }),
            ]),
        ]);
        const baseline = diagram([
            table('t', [field('id', { id: 'b1' }), field('age', { id: 'b2' })]),
        ]);
        const proposed = diagram([
            table('t', [
                field('id', { id: 'p1' }),
                field('age', {
                    id: 'p2',
                    type: { id: 'bigint', name: 'bigint' },
                    nullable: false,
                }),
            ]),
        ]);
        const { merged, diff } = run(current, baseline, proposed);
        const [id, age] = merged.tables![0].fields;
        expect(id).toMatchObject({ primaryKey: true, unique: true });
        expect(age).toMatchObject({
            id: 'age',
            nullable: false,
            default: '0',
            type: { name: 'bigint' },
        });
        expect(diff.tables[0].changedFields).toEqual([
            {
                name: 'age',
                changes: ['тип: integer → bigint', 'NULL → NOT NULL'],
            },
        ]);
    });

    it('колонку и таблицу, которых импорт не прочитал, не удаляет; удаление ИИ — удаляет', () => {
        const current = diagram([
            table('a', [field('id'), field('email'), field('old')], {
                id: 'a',
            }),
            table('lost', [field('id')], { id: 'lost' }),
            table('gone', [field('id')], { id: 'gone' }),
        ]);
        const baseline = diagram([
            table('a', [field('id'), field('old')]),
            table('gone', [field('id')]),
        ]);
        const proposed = diagram([table('a', [field('id')])]);
        const { merged, diff } = run(current, baseline, proposed);
        expect(merged.tables!.map((t) => t.name)).toEqual(['a', 'lost']);
        expect(merged.tables![0].fields.map((f) => f.name)).toEqual([
            'id',
            'email',
        ]);
        expect(diff.tables).toEqual([
            expect.objectContaining({ name: 'a', removedFields: ['old'] }),
            expect.objectContaining({ name: 'gone', status: 'removed' }),
        ]);
    });

    it('правки одних только CHECK, комментария и точности видны в диффе', () => {
        const current = diagram([
            table(
                't',
                [field('price', { id: 'price', precision: 10, scale: 2 })],
                {
                    id: 't',
                }
            ),
        ]);
        const baseline = diagram([
            table('t', [field('price', { precision: 10, scale: 2 })]),
        ]);
        const proposed = diagram([
            table('t', [field('price', { precision: 12, scale: 4 })], {
                comments: 'Цены',
                checkConstraints: [
                    { id: 'c', expression: 'price >= 0', createdAt: 1 },
                ],
            }),
        ]);
        const { merged, diff } = run(current, baseline, proposed);
        expect(diff.isEmpty).toBe(false);
        expect(diff.tables[0].otherChanges).toEqual([
            'изменён комментарий таблицы',
            '+ CHECK (price >= 0)',
        ]);
        expect(diff.tables[0].changedFields[0].changes).toEqual([
            'точность: 10/2 → 12/4',
        ]);
        expect(merged.tables![0].fields[0]).toMatchObject({
            precision: 12,
            scale: 4,
        });
        expect(merged.tables![0].checkConstraints).toHaveLength(1);
    });

    it('ИИ может удалить и переименовать индекс', () => {
        const current = diagram([
            table(
                't',
                [field('email', { id: 'e' }), field('city', { id: 'c' })],
                {
                    id: 't',
                    indexes: [ix('dup_email', ['e']), ix('idx_city', ['c'])],
                }
            ),
        ]);
        const baseline = diagram([
            table(
                't',
                [field('email', { id: 'be' }), field('city', { id: 'bc' })],
                {
                    indexes: [ix('dup_email', ['be']), ix('idx_city', ['bc'])],
                }
            ),
        ]);
        const proposed = diagram([
            table(
                't',
                [field('email', { id: 'pe' }), field('city', { id: 'pc' })],
                {
                    indexes: [ix('idx_city_new', ['pc'])],
                }
            ),
        ]);
        const { merged, diff } = run(current, baseline, proposed);
        // dup_email убран, idx_city переименован, остальное нетронуто
        expect(merged.tables![0].indexes.map((i) => i.name)).toEqual([
            'idx_city_new',
        ]);
        expect(diff.tables[0].removedIndexes).toEqual(['dup_email']);
        expect(diff.tables[0].otherChanges).toEqual([
            'индекс idx_city → idx_city_new',
        ]);
    });

    it('новые и изменённые enum-типы попадают в схему', () => {
        const status = {
            id: 'ct1',
            name: 'order_status',
            kind: DBCustomTypeKind.enum,
            values: ['new', 'paid'],
        };
        const current = diagram([table('o', [field('id')])], [], {
            customTypes: [status],
        });
        const baseline = diagram([table('o', [field('id')])], [], {
            customTypes: [{ ...status, id: 'b' }],
        });
        const proposed = diagram([table('o', [field('id')])], [], {
            customTypes: [
                { ...status, id: 'p1', values: ['new', 'paid', 'shipped'] },
                {
                    id: 'p2',
                    name: 'kind',
                    kind: DBCustomTypeKind.enum,
                    values: ['a'],
                },
            ],
        });
        const { merged, diff } = run(current, baseline, proposed);
        expect(merged.customTypes!.map((t) => t.name)).toEqual([
            'order_status',
            'kind',
        ]);
        expect(merged.customTypes![0]).toMatchObject({
            id: 'ct1',
            values: ['new', 'paid', 'shipped'],
        });
        expect(diff.changedTypes).toEqual(['order_status']);
        expect(diff.addedTypes).toEqual(['kind']);
        expect(diff.isEmpty).toBe(false);
    });

    it('связь, убранную ИИ, удаляет; добавленную — добавляет; импортом не прочитанную оставляет', () => {
        const users = table('users', [field('id')], { id: 'u' });
        const orders = table('orders', [field('id'), field('user_id')], {
            id: 'o',
        });
        const items = table('items', [field('id'), field('order_id')], {
            id: 'i',
        });
        const current = diagram(
            [users, orders, items],
            [relationship(orders, 'user_id', users, 'id')]
        );
        const clone = () =>
            [
                table('users', [field('id')]),
                table('orders', [field('id'), field('user_id')]),
                table('items', [field('id'), field('order_id')]),
            ] as const;
        const [bu, bo, bi] = clone();
        const baseline = diagram(
            [bu, bo, bi],
            [relationship(bo, 'user_id', bu, 'id')]
        );
        const [pu, po, pi] = clone();
        const proposed = diagram(
            [pu, po, pi],
            [relationship(pi, 'order_id', po, 'id')]
        );
        const { merged, diff } = run(current, baseline, proposed);
        expect(merged.relationships).toHaveLength(1);
        expect(merged.relationships![0]).toMatchObject({
            sourceTableId: 'i',
            targetTableId: 'o',
        });
        expect(diff.removedRelationships).toEqual([
            'orders.user_id → users.id',
        ]);
        expect(diff.addedRelationships).toEqual(['items.order_id → orders.id']);
    });
});
