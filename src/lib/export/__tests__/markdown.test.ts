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

    it('keeps a default with backticks a single valid code span', () => {
        const out = diagramToMarkdown(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 't',
                        name: 'a',
                        fields: [
                            makeField({
                                id: 'f',
                                name: 'x',
                                default: "'a`b'",
                            }),
                            makeField({ id: 'g', name: 'y', default: '`z`' }),
                        ],
                    }),
                ],
            })
        );
        expect(out).toContain("| x | integer |  | да | ``'a`b'`` |  |");
        expect(out).toContain('| y | integer |  | да | `` `z` `` |  |');
    });

    it('keeps headings on one line when names contain newlines', () => {
        const out = diagramToMarkdown(
            makeDiagram({
                name: 'My\r\nSchema\nX',
                tables: [makeTable({ id: 't', name: 'ta\nble\rx' })],
            })
        );
        expect(out.startsWith('# My Schema X\n')).toBe(true);
        expect(out).toContain('\n## ta ble x\n');
        expect(out).not.toContain('\r');
    });

    it('falls back to a placeholder for an empty heading', () => {
        const out = diagramToMarkdown(makeDiagram({ name: ' \n ' }));
        expect(out.startsWith('# Без названия\n')).toBe(true);
    });

    it('keeps index and relationship lines on one line with pipes and newlines', () => {
        const d = shopDiagram();
        (d.relationships ?? [])[0].name = 'fk|a\nb';
        (d.tables ?? [])[0].indexes = [
            makeIndex({ id: 'i', name: 'ix|a\nb', fieldIds: ['u-id'] }),
        ];
        const out = diagramToMarkdown(d);
        expect(out).toContain('- `ix|a b` (id)');
        expect(out).toContain('(one:many, fk\\|a b)');
    });

    it('protects backticks in table names inside relationship lines', () => {
        const d = shopDiagram();
        (d.tables ?? [])[0].name = 'us`ers';
        const out = diagramToMarkdown(d);
        expect(out).toContain('``us`ers.id`` → `orders.user_id`');
    });

    it('handles an empty diagram', () => {
        const out = diagramToMarkdown(makeDiagram({ name: 'Пусто' }));
        expect(out).toContain('# Пусто');
        expect(out).toContain('таблиц: 0');
        expect(out).not.toContain('## Связи');
    });
});
