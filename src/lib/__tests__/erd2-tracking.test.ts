import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import {
    buildSnapshotPayload,
    diffActions,
    resolveSource,
} from '../erd2-tracking';

describe('diffActions', () => {
    it('detects one added table', () => {
        expect(
            diffActions(
                { tables: 1, relations: 0 },
                { tables: 2, relations: 0 }
            )
        ).toEqual(['table_add']);
    });
    it('treats a jump of two or more tables as an import', () => {
        expect(
            diffActions(
                { tables: 0, relations: 0 },
                { tables: 5, relations: 3 }
            )
        ).toEqual(['import']);
    });
    it('detects an added relation', () => {
        expect(
            diffActions(
                { tables: 2, relations: 0 },
                { tables: 2, relations: 1 }
            )
        ).toEqual(['relation_add']);
    });
    it('ignores removals and no-ops', () => {
        expect(
            diffActions(
                { tables: 3, relations: 2 },
                { tables: 2, relations: 1 }
            )
        ).toEqual([]);
        expect(
            diffActions(
                { tables: 3, relations: 2 },
                { tables: 3, relations: 2 }
            )
        ).toEqual([]);
    });
});

describe('buildSnapshotPayload', () => {
    const diagram = {
        id: 'd1',
        name: 'Секретное название',
        databaseType: DatabaseType.POSTGRESQL,
        createdAt: new Date(),
        updatedAt: new Date(),
        tables: [
            {
                id: 't1',
                name: 'users_private',
                fields: [{ id: 'f1' }, { id: 'f2' }],
            },
            { id: 't2', name: 'orders', fields: [{ id: 'f3' }] },
        ],
        relationships: [{ id: 'r1' }],
    } as unknown as Diagram;

    it('counts tables, relations and fields', () => {
        expect(buildSnapshotPayload(diagram, true)).toEqual({
            tables: 2,
            relations: 1,
            fields: 3,
            db_type: 'postgresql',
            is_cloud: true,
        });
    });

    it('never leaks names', () => {
        const json = JSON.stringify(buildSnapshotPayload(diagram, false));
        expect(json).not.toContain('users_private');
        expect(json).not.toContain('Секретное');
    });

    it('handles an empty diagram', () => {
        const empty = {
            ...diagram,
            tables: undefined,
            relationships: undefined,
        } as Diagram;
        expect(buildSnapshotPayload(empty, false)).toMatchObject({
            tables: 0,
            relations: 0,
            fields: 0,
        });
    });
});

describe('resolveSource', () => {
    it('prefers the stored template marker', () => {
        expect(resolveSource('', 'template')).toBe('template');
    });
    it('detects landing referrer', () => {
        expect(resolveSource('https://sqllab.ru/tools/erd2/about', null)).toBe(
            'landing'
        );
        expect(resolveSource('https://sqllab.ru/tools/erd2/', null)).toBe(
            'landing'
        );
    });
    it('falls back to direct', () => {
        expect(resolveSource('', null)).toBe('direct');
        expect(resolveSource('https://google.com/', null)).toBe('direct');
    });
});
