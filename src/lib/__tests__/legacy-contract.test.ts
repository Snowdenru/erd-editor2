import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { reviveDiagram } from '../cloud-diagrams';

// Фикстуры сгенерированы конвертером старых схем (sql-platform/backend/scripts/gen_legacy_erd_fixtures.py).
// Тест ловит расхождение формата Diagram2.content с zod-схемой ChartDB.
const dir = path.join(__dirname, 'fixtures');
const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^legacy-.*\.json$/.test(f))
    : [];

describe('схемы из старого редактора проходят diagramSchema', () => {
    it('фикстуры найдены', () => {
        expect(files.length).toBeGreaterThanOrEqual(2);
    });

    it.each(files)('%s', (file) => {
        const content = JSON.parse(
            fs.readFileSync(path.join(dir, file), 'utf8')
        );
        const diagram = reviveDiagram({
            id: content.id,
            title: content.name,
            content,
            updated_at: content.updatedAt,
        });
        expect(diagram).not.toBeNull();
        expect(diagram!.tables).toHaveLength(content.tables.length);
        expect(diagram!.relationships).toHaveLength(
            content.relationships.length
        );
        expect(diagram!.updatedAt.toISOString()).toBe(content.updatedAt);
    });

    it('ссылки связей указывают на существующие таблицы и поля', () => {
        for (const file of files) {
            const content = JSON.parse(
                fs.readFileSync(path.join(dir, file), 'utf8')
            );
            const tableIds = new Set(
                content.tables.map((t: { id: string }) => t.id)
            );
            const fieldIds = new Set(
                content.tables.flatMap((t: { fields: { id: string }[] }) =>
                    t.fields.map((f) => f.id)
                )
            );
            for (const r of content.relationships) {
                expect(tableIds.has(r.sourceTableId)).toBe(true);
                expect(tableIds.has(r.targetTableId)).toBe(true);
                expect(fieldIds.has(r.sourceFieldId)).toBe(true);
                expect(fieldIds.has(r.targetFieldId)).toBe(true);
            }
        }
    });
});
