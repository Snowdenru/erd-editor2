import { describe, it, expect } from 'vitest';
import {
    planPull,
    reviveDiagram,
    type CloudDiagramRow,
} from '../cloud-diagrams';
import { DatabaseType } from '../domain/database-type';
import type { Diagram } from '../domain/diagram';

const diagram = (id: string, updatedAt: string, name = 'D'): Diagram => ({
    id,
    name,
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(updatedAt),
});

const row = (over: Partial<CloudDiagramRow> = {}): CloudDiagramRow => ({
    id: 'a1',
    title: 'Магазин',
    updated_at: '2026-09-01T10:00:00Z',
    content: {
        id: 'a1',
        name: 'старое имя',
        databaseType: 'postgresql',
        tables: [],
        relationships: [],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    },
    ...over,
});

describe('reviveDiagram', () => {
    it('turns a server row into a Diagram with real Date fields', () => {
        const d = reviveDiagram(row());
        expect(d?.id).toBe('a1');
        expect(d?.name).toBe('Магазин');
        // updatedAt — из содержимого (метка клиента), а не из серверного updated_at
        expect(d?.updatedAt).toEqual(new Date('2026-08-01T00:00:00Z'));
        expect(d?.createdAt).toEqual(new Date('2026-08-01T00:00:00Z'));
    });

    it('falls back to the server updated_at when content has no updatedAt', () => {
        const r = row();
        delete (r.content as Record<string, unknown>).updatedAt;
        expect(reviveDiagram(r)?.updatedAt).toEqual(
            new Date('2026-09-01T10:00:00Z')
        );
    });

    it('returns null for content that is not a diagram', () => {
        expect(reviveDiagram(row({ content: { tables: 'oops' } }))).toBeNull();
        expect(reviveDiagram(row({ content: null }))).toBeNull();
    });
});

describe('planPull', () => {
    it('adds cloud diagrams that are missing locally', () => {
        const plan = planPull([diagram('a1', '2026-09-01T00:00:00Z')], []);
        expect(plan).toEqual([
            { kind: 'add', diagram: expect.objectContaining({ id: 'a1' }) },
        ]);
    });

    it('does nothing when local is newer or equal (sync provider will push it)', () => {
        const cloud = [diagram('a1', '2026-09-01T00:00:00Z')];
        expect(
            planPull(cloud, [diagram('a1', '2026-09-02T00:00:00Z')])
        ).toEqual([]);
        expect(
            planPull(cloud, [diagram('a1', '2026-09-01T00:00:00Z')])
        ).toEqual([]);
    });

    it('replaces an older local diagram and keeps it as a backup copy', () => {
        const local = diagram('a1', '2026-08-01T00:00:00Z', 'Локальная');
        const cloud = diagram('a1', '2026-09-01T00:00:00Z', 'Облачная');
        expect(planPull([cloud], [local])).toEqual([
            { kind: 'replace', diagram: cloud, backupOf: local },
        ]);
    });
});
