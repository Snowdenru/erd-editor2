import { describe, it, expect } from 'vitest';
import { diagramToMermaid } from '../mermaid';
import { makeDiagram, makeField, makeTable, shopDiagram } from './fixtures';

describe('diagramToMermaid', () => {
    it('renders entities, keys and the relationship', () => {
        expect(diagramToMermaid(shopDiagram())).toBe(
            [
                'erDiagram',
                '    users {',
                '        integer id PK',
                '        varchar email UK "Почта"',
                '    }',
                '    orders {',
                '        integer id PK',
                '        integer user_id FK',
                '    }',
                '    users ||--o{ orders : "fk_orders_users"',
                '',
            ].join('\n')
        );
    });

    it('returns only the header for an empty diagram', () => {
        expect(diagramToMermaid(makeDiagram())).toBe('erDiagram\n');
    });

    it('quotes entity names that are not plain identifiers and transliterates attributes', () => {
        const out = diagramToMermaid(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 't1',
                        name: 'Заказы',
                        fields: [makeField({ id: 'f1', name: 'Номер заказа' })],
                    }),
                ],
            })
        );
        expect(out).toContain('"Заказы" {');
        expect(out).toContain('integer nomer_zakaza');
    });

    it('skips views and prefixes non-default schemas', () => {
        const out = diagramToMermaid(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 'v',
                        name: 'report_view',
                        isView: true,
                        fields: [makeField({ id: 'x', name: 'a' })],
                    }),
                    makeTable({
                        id: 't',
                        name: 'items',
                        schema: 'sales',
                        fields: [makeField({ id: 'y', name: 'id' })],
                    }),
                    makeTable({
                        id: 'p',
                        name: 'users',
                        schema: 'public',
                        fields: [makeField({ id: 'z', name: 'id' })],
                    }),
                ],
            })
        );
        expect(out).not.toContain('report_view');
        expect(out).toContain('"sales.items" {');
        expect(out).toContain('    users {');
    });

    it('keeps entity names unique', () => {
        const out = diagramToMermaid(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 'a',
                        name: 'items',
                        fields: [makeField({ id: 'f1', name: 'id' })],
                    }),
                    makeTable({
                        id: 'b',
                        name: 'items',
                        fields: [makeField({ id: 'f2', name: 'id' })],
                    }),
                ],
            })
        );
        expect(out).toContain('    items {');
        expect(out).toContain('    items_2 {');
    });

    it('maps cardinalities to mermaid symbols and drops dangling relationships', () => {
        const base = shopDiagram();
        const [rel] = base.relationships ?? [];
        const out = diagramToMermaid({
            ...base,
            relationships: [
                {
                    ...rel,
                    sourceCardinality: 'many',
                    targetCardinality: 'many',
                    name: '',
                },
                { ...rel, id: 'r2', targetTableId: 'missing' },
            ],
        });
        expect(out).toContain('users }o--o{ orders : "relates"');
        expect(out).not.toContain('missing');
    });

    it('never puts double quotes inside quoted strings', () => {
        const out = diagramToMermaid(
            makeDiagram({
                tables: [
                    makeTable({
                        id: 't',
                        name: 'a"b',
                        fields: [
                            makeField({
                                id: 'f',
                                name: 'x',
                                comments: 'say "hi"\nnow',
                            }),
                        ],
                    }),
                ],
            })
        );
        expect(out).toContain(`"a'b" {`);
        expect(out).toContain(`"say 'hi' now"`);
    });
});
