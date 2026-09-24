import { describe, it, expect } from 'vitest';
import { diagramToMarkdown } from '../markdown';
import {
    makeDiagram,
    makeField,
    makeIndex,
    makeTable,
    shopDiagram,
} from './fixtures';

describe('diagramToMarkdown', () => {
    const md = diagramToMarkdown(shopDiagram());

    it('has a title and a summary line', () => {
        expect(md.startsWith('# Shop\n')).toBe(true);
        expect(md).toContain('PostgreSQL · таблиц: 2 · связей: 1');
    });

    it('lists tables with their comments', () => {
        expect(md).toContain('## users');
        expect(md).toContain('Покупатели');
        expect(md).toContain('## orders');
    });

    it('renders a field table with types, keys, nullability, defaults and comments', () => {
        expect(md).toContain(
            '| Поле | Тип | Ключ | NULL | По умолчанию | Описание |'
        );
        expect(md).toContain('| id | integer | PK | нет |  |  |');
        expect(md).toContain('| email | varchar(255) | UK | да |  | Почта |');
        expect(md).toContain('| user_id | integer | FK | нет | `0` |  |');
    });

    it('describes relationships by table and field names', () => {
        expect(md).toContain('## Связи');
        expect(md).toContain(
            '`users.id` → `orders.user_id` (one:many, fk_orders_users)'
        );
    });

    it('lists indexes', () => {
        const out = diagramToMarkdown(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 't',
                        name: 'items',
                        fields: [
                            makeField({ id: 'a', name: 'sku' }),
                            makeField({ id: 'b', name: 'title' }),
                        ],
                        indexes: [
                            makeIndex({
                                id: 'i1',
                                name: 'ux_sku',
                                unique: true,
                                fieldIds: ['a'],
                            }),
                            makeIndex({
                                id: 'i2',
                                name: 'ix_sku_title',
                                fieldIds: ['a', 'b'],
                            }),
                        ],
                    }),
                ],
            })
        );
        expect(out).toContain('- `ux_sku` (sku), уникальный');
        expect(out).toContain('- `ix_sku_title` (sku, title)');
    });

    it('escapes pipes and newlines in cells', () => {
        const out = diagramToMarkdown(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 't',
                        name: 'a',
                        fields: [
                            makeField({
                                id: 'f',
                                name: 'x|y',
                                comments: 'line1\nline2',
                            }),
                        ],
                    }),
                ],
            })
        );
        expect(out).toContain('| x\\|y |');
        expect(out).toContain('line1 line2');
    });

    it('handles an empty diagram', () => {
        const out = diagramToMarkdown(makeDiagram({ name: 'Пусто' }));
        expect(out).toContain('# Пусто');
        expect(out).toContain('таблиц: 0');
        expect(out).not.toContain('## Связи');
    });
});
