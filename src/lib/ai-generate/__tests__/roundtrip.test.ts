import { describe, expect, it } from 'vitest';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import type { Diagram } from '@/lib/domain/diagram';
import type { DatabaseType } from '@/lib/domain/database-type';
import { diffDiagrams } from '../diagram-diff';
import { toDatabaseType } from '../dialect';
import { ddlToDiagram } from '../import-ddl';
import { mergeAiDiagram } from '../merge-diagram';
import { sanitizeDdlForAi } from '../sanitize-ddl';
import type { AiDialect } from '../types';
import { diagram, field, relationship, table } from './fixtures';

const TYPES: Record<AiDialect, { int: string; text: string; ts: string }> = {
    postgresql: { int: 'integer', text: 'varchar', ts: 'timestamp' },
    mysql: { int: 'int', text: 'varchar', ts: 'datetime' },
    mssql: { int: 'int', text: 'varchar', ts: 'datetime' },
    sqlite: { int: 'integer', text: 'text', ts: 'timestamp' },
};

// Реалистичная схема: 3 обычные таблицы (связь 1:1 и 1:n), CHECK, индекс, комментарии, таблица со schema,
// плюс представление и связь m:n, которых в экспорте для модели нет.
// id поля уникален в пределах схемы (в fixtures он зависит только от имени поля)
const uf = (
    tableName: string,
    name: string,
    extra: Parameters<typeof field>[1] = {}
) => field(name, { id: `${tableName}.${name}`, ...extra });

const buildDiagram = (dialect: AiDialect): Diagram => {
    const t = TYPES[dialect];
    const int = { id: t.int, name: t.int };
    const text = { id: t.text, name: t.text };
    const ts = { id: t.ts, name: t.ts };
    const withSchema = dialect === 'postgresql' || dialect === 'mssql';

    const users = table(
        'users',
        [
            uf('users', 'id', {
                type: int,
                primaryKey: true,
                nullable: false,
                unique: true,
                comments: 'Идентификатор',
            }),
            uf('users', 'email', {
                type: text,
                characterMaximumLength: '255',
                nullable: false,
                unique: true,
                comments: 'Почта',
            }),
            uf('users', 'age', { type: int }),
            uf('users', 'created_at', { type: ts, nullable: false }),
        ],
        {
            x: 100,
            y: 50,
            comments: 'Пользователи',
            ...(withSchema
                ? { schema: dialect === 'mssql' ? 'dbo' : 'public' }
                : {}),
            checkConstraints: [
                { id: 'chk1', expression: 'age >= 0', createdAt: 1 },
            ],
        }
    );
    const profiles = table(
        'profiles',
        [
            uf('profiles', 'id', {
                type: int,
                primaryKey: true,
                nullable: false,
            }),
            uf('profiles', 'user_id', { type: int, nullable: false }),
            uf('profiles', 'bio', {
                type: text,
                characterMaximumLength: '500',
            }),
        ],
        { x: 450, y: 60, createdAt: 2 }
    );
    const orders = table(
        'orders',
        [
            uf('orders', 'id', {
                type: int,
                primaryKey: true,
                nullable: false,
            }),
            uf('orders', 'user_id', { type: int, nullable: false }),
            uf('orders', 'total', { type: int, nullable: false }),
        ],
        { x: 100, y: 400, createdAt: 3 }
    );
    orders.indexes = [
        {
            id: 'ix1',
            name: 'idx_orders_user',
            unique: false,
            fieldIds: [orders.fields[1].id],
            createdAt: 1,
        },
    ];
    const tags = table(
        'tags',
        [uf('tags', 'id', { type: int, primaryKey: true, nullable: false })],
        { x: 450, y: 400, createdAt: 4 }
    );
    const view = table(
        'v_orders',
        [
            uf('v_orders', 'order_id', { type: int }),
            uf('v_orders', 'email', { type: text }),
        ],
        { id: 't-view', isView: true, x: 800, y: 100, createdAt: 5 }
    );

    return diagram(
        [users, profiles, orders, tags, view],
        [
            relationship(profiles, 'user_id', users, 'id', {
                sourceCardinality: 'one',
                targetCardinality: 'one',
            }),
            relationship(orders, 'user_id', users, 'id'),
            relationship(users, 'id', tags, 'id', {
                id: 'r-mn',
                name: 'users_tags',
                sourceCardinality: 'many',
                targetCardinality: 'many',
            }),
            relationship(view, 'order_id', orders, 'id', { id: 'r-view' }),
        ],
        { databaseType: toDatabaseType(dialect) as DatabaseType }
    );
};

// Что импорт не умеет читать (индексы mysql/sqlite, комментарии, длины sqlite, поле после `-- ...` в mssql),
// в схеме остаётся: к ней применяется только разница между базовым импортом и ответом ИИ (здесь — пустая).
const stripUpdated = (d: Diagram) => ({ ...d, updatedAt: undefined });

describe.each(['postgresql', 'mysql', 'mssql', 'sqlite'] as AiDialect[])(
    'круговой тест экспорт → импорт (%s)',
    (dialect) => {
        const roundtrip = async (d: Diagram): Promise<Diagram> =>
            ddlToDiagram({
                // как в хуке: экспорт → очистка DDL → импорт
                ddl: sanitizeDdlForAi(
                    exportBaseSQL({
                        diagram: structuredClone(d),
                        targetDatabaseType: d.databaseType,
                    }),
                    dialect
                ),
                dialect,
                prompt: d.name,
            });

        it('слияние с собственным экспортом не меняет схему: diff пуст', async () => {
            const d = buildDiagram(dialect);
            const back = await roundtrip(d);
            const merged = mergeAiDiagram(d, back, back);
            expect(diffDiagrams(d, merged)).toEqual({
                tables: [],
                addedRelationships: [],
                removedRelationships: [],
                addedTypes: [],
                changedTypes: [],
                isEmpty: true,
            });
        });

        it('слияние с собственным экспортом равно исходной схеме (кроме updatedAt)', async () => {
            const d = buildDiagram(dialect);
            const back = await roundtrip(d);
            const merged = mergeAiDiagram(d, back, back);
            expect(stripUpdated(merged)).toEqual(stripUpdated(d));
            // и идемпотентно
            expect(stripUpdated(mergeAiDiagram(merged, back, back))).toEqual(
                stripUpdated(merged)
            );
        });
    }
);
