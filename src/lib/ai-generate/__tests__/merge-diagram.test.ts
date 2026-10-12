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

    describe('то, чего нет в экспорте для модели', () => {
        const users = table('users', [field('id', { primaryKey: true })], {
            schema: 'public',
            x: 10,
        });
        const tags = table('tags', [field('id', { primaryKey: true })]);
        const view = table('v_users', [field('id')], {
            id: 'view-id',
            isView: true,
            x: 500,
        });
        const mn = relationship(users, 'id', tags, 'id', {
            id: 'r-mn',
            sourceCardinality: 'many',
            targetCardinality: 'many',
        });
        const viewRel = relationship(view, 'id', users, 'id', {
            id: 'r-view',
        });
        const current = diagram([users, tags, view], [mn, viewRel]);
        // модель вернула только обычные таблицы, без схемы и без связей
        const proposal = () =>
            diagram([
                table('users', [field('id', { id: 'p-u' })], {
                    id: 'p-users',
                }),
                table('tags', [field('id', { id: 'p-t' })], { id: 'p-tags' }),
            ]);

        it('оставляет представления на месте, после предложенных таблиц', () => {
            const merged = mergeAiDiagram(current, proposal());
            expect(merged.tables!.map((t) => t.name)).toEqual([
                'users',
                'tags',
                'v_users',
            ]);
            expect(merged.tables!.at(-1)).toBe(view);
        });

        it('не заменяет представление одноимённой таблицей из ответа', () => {
            const p = proposal();
            p.tables!.push(table('V_Users', [field('id')], { id: 'p-v' }));
            const merged = mergeAiDiagram(current, p);
            expect(
                merged.tables!.filter((t) => t.name.match(/v_users/i))
            ).toHaveLength(1);
            expect(merged.tables!.find((t) => t.id === 'view-id')).toBe(view);
        });

        it('переносит m:n и связи с представлениями', () => {
            const merged = mergeAiDiagram(current, proposal());
            expect(merged.relationships).toEqual([mn, viewRel]);
        });

        it('не дублирует связь, уже полученную из ответа', () => {
            const p = proposal();
            p.relationships = [
                relationship(p.tables![0], 'id', p.tables![1], 'id', {
                    sourceCardinality: 'many',
                    targetCardinality: 'many',
                }),
            ];
            const merged = mergeAiDiagram(current, p);
            expect(merged.relationships).toHaveLength(2);
            expect(
                merged.relationships!.filter((r) => r.id === 'r-mn')
            ).toHaveLength(1);
        });

        it('отбрасывает перенесённые связи, если таблица или поле исчезли', () => {
            const noTags = diagram([
                table('users', [field('id', { id: 'p-u' })]),
            ]);
            expect(mergeAiDiagram(current, noTags).relationships).toEqual([
                viewRel,
            ]);
            const noViewField = diagram([
                table('users', [field('other', { id: 'p-o' })]),
                table('tags', [field('id', { id: 'p-t' })]),
            ]);
            expect(mergeAiDiagram(current, noViewField).relationships).toEqual(
                []
            );
        });

        it('сохраняет schema совпавшей таблицы, даже если модель её не указала', () => {
            const merged = mergeAiDiagram(current, proposal());
            expect(merged.tables!.find((t) => t.name === 'users')!.schema).toBe(
                'public'
            );
            const p = proposal();
            p.tables![0].schema = 'other';
            expect(
                mergeAiDiagram(current, p).tables!.find(
                    (t) => t.name === 'users'
                )!.schema
            ).toBe('public');
        });
    });

    describe('политика слияния: основа — текущая схема', () => {
        const proposalOf = (
            fields: ReturnType<typeof field>[],
            extra: Parameters<typeof table>[2] = {}
        ) => diagram([table('users', fields, { id: 'p-users', ...extra })]);

        it('атрибуты поля переживают предложение, в котором их нет', () => {
            const current = diagram([
                table('users', [
                    field('email', {
                        id: 'e',
                        type: { id: 'varchar', name: 'varchar' },
                        characterMaximumLength: '255',
                        default: "'a@b.c'",
                        comments: 'Почта',
                        check: "email <> ''",
                        collation: 'C',
                    }),
                ]),
            ]);
            const proposed = proposalOf([
                field('email', {
                    id: 'pe',
                    type: { id: 'varchar', name: 'varchar' },
                    characterMaximumLength: '',
                    default: null,
                    comments: '',
                    check: undefined,
                }),
            ]);
            const f = mergeAiDiagram(current, proposed).tables![0].fields[0];
            expect(f).toMatchObject({
                id: 'e',
                characterMaximumLength: '255',
                default: "'a@b.c'",
                comments: 'Почта',
                check: "email <> ''",
                collation: 'C',
            });
        });

        it('смена типа берёт тип и длину предложения; синонимы типом не считаются', () => {
            const current = diagram([
                table('users', [
                    field('a', {
                        id: 'a',
                        type: { id: 'varchar', name: 'varchar' },
                        characterMaximumLength: '255',
                    }),
                    field('b', {
                        id: 'b',
                        type: { id: 'integer', name: 'integer' },
                    }),
                ]),
            ]);
            const proposed = proposalOf([
                field('a', {
                    id: 'pa',
                    type: { id: 'text', name: 'text' },
                    characterMaximumLength: undefined,
                }),
                field('b', { id: 'pb', type: { id: 'int', name: 'int' } }),
            ]);
            const [a, b] = mergeAiDiagram(current, proposed).tables![0].fields;
            expect(a.type.name).toBe('text');
            expect(a.characterMaximumLength).toBeUndefined();
            expect(b.type).toEqual({ id: 'integer', name: 'integer' });
        });

        it('осознанное изменение nullable применяется', () => {
            const current = diagram([
                table('users', [field('age', { id: 'age', nullable: true })]),
            ]);
            const proposed = proposalOf([
                field('age', { id: 'p', nullable: false }),
            ]);
            expect(
                mergeAiDiagram(current, proposed).tables![0].fields[0].nullable
            ).toBe(false);
        });

        it('индексы: старые остаются, новый добавляется, дубль и PK-индекс игнорируются', () => {
            const id = field('id', {
                id: 'id',
                primaryKey: true,
                nullable: false,
            });
            const email = field('email', { id: 'email' });
            const city = field('city', { id: 'city' });
            const current = diagram([
                table('users', [id, email, city], {
                    indexes: [
                        {
                            id: 'ix-old',
                            name: 'idx_email',
                            unique: false,
                            fieldIds: ['email'],
                            createdAt: 1,
                        },
                    ],
                }),
            ]);
            const pid = field('id', {
                id: 'pid',
                primaryKey: true,
                nullable: false,
            });
            const pemail = field('email', { id: 'pemail' });
            const pcity = field('city', { id: 'pcity' });
            const proposed = proposalOf([pid, pemail, pcity], {
                indexes: [
                    // то же самое под другим именем
                    {
                        id: 'p1',
                        name: 'renamed',
                        unique: false,
                        fieldIds: ['pemail'],
                        createdAt: 1,
                    },
                    {
                        id: 'p2',
                        name: 'idx_city',
                        unique: false,
                        fieldIds: ['pcity'],
                        createdAt: 1,
                    },
                    // безымянный уникальный индекс по PK, который добавляет импорт
                    {
                        id: 'p3',
                        name: '',
                        unique: true,
                        fieldIds: ['pid'],
                        createdAt: 1,
                    },
                ],
            });
            const merged = mergeAiDiagram(current, proposed).tables![0];
            expect(merged.indexes.map((i) => i.name)).toEqual([
                'idx_email',
                'idx_city',
            ]);
            expect(merged.indexes[0].id).toBe('ix-old');
            expect(merged.indexes[1].fieldIds).toEqual(['city']);
        });

        it('индекс по удалённому полю пропадает вместе с полем', () => {
            const current = diagram([
                table(
                    'users',
                    [field('a', { id: 'a' }), field('b', { id: 'b' })],
                    {
                        indexes: [
                            {
                                id: 'ix',
                                name: 'idx_b',
                                unique: false,
                                fieldIds: ['b'],
                                createdAt: 1,
                            },
                        ],
                    }
                ),
            ]);
            const proposed = proposalOf([field('a', { id: 'pa' })]);
            expect(
                mergeAiDiagram(current, proposed).tables![0].indexes
            ).toEqual([]);
        });

        it('комментарий таблицы и CHECK переживают пустое предложение, непустое берётся', () => {
            const checks = [{ id: 'c1', expression: 'age >= 0', createdAt: 1 }];
            const current = diagram([
                table('users', [field('age')], {
                    comments: 'Пользователи',
                    checkConstraints: checks,
                }),
            ]);
            const kept = mergeAiDiagram(
                current,
                proposalOf([field('age')], {
                    comments: '',
                    checkConstraints: [],
                })
            ).tables![0];
            expect(kept.comments).toBe('Пользователи');
            expect(kept.checkConstraints).toEqual(checks);

            const changed = mergeAiDiagram(
                current,
                proposalOf([field('age')], {
                    comments: 'Новый',
                    checkConstraints: [
                        { id: 'n', expression: 'age > 18', createdAt: 2 },
                    ],
                })
            ).tables![0];
            expect(changed.comments).toBe('Новый');
            expect(changed.checkConstraints![0].expression).toBe('age > 18');
        });

        it('обратная запись связи 1:1 не создаёт дубль', () => {
            const users = table('users', [field('id', { id: 'u.id' })], {
                id: 'tu',
            });
            const profiles = table(
                'profiles',
                [field('user_id', { id: 'p.user_id' })],
                { id: 'tp' }
            );
            const old = relationship(profiles, 'user_id', users, 'id', {
                id: 'old-rel',
                sourceCardinality: 'one',
                targetCardinality: 'one',
            });
            const current = diagram([users, profiles], [old]);
            const pu = table('users', [field('id', { id: 'pu.id' })], {
                id: 'ptu',
            });
            const pp = table(
                'profiles',
                [field('user_id', { id: 'pp.user_id' })],
                { id: 'ptp' }
            );
            const reversed = relationship(pu, 'id', pp, 'user_id', {
                id: 'new-rel',
                sourceCardinality: 'one',
                targetCardinality: 'one',
            });
            const merged = mergeAiDiagram(
                current,
                diagram([pu, pp], [reversed])
            );
            expect(merged.relationships).toEqual([old]);
        });
    });
});
