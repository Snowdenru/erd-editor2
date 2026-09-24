import { describe, it, expect } from 'vitest';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import { foreignKeyFieldIds } from '../foreign-keys';

const rel = (
    sourceCardinality: 'one' | 'many',
    targetCardinality: 'one' | 'many'
): DBRelationship => ({
    id: 'r',
    name: 'r',
    sourceTableId: 't1',
    targetTableId: 't2',
    sourceFieldId: 'src',
    targetFieldId: 'tgt',
    sourceCardinality,
    targetCardinality,
    createdAt: 0,
});

describe('foreignKeyFieldIds', () => {
    it('many -> one: the source field is the FK', () => {
        expect([...foreignKeyFieldIds([rel('many', 'one')])]).toEqual(['src']);
    });

    it('one -> many: the target field is the FK', () => {
        expect([...foreignKeyFieldIds([rel('one', 'many')])]).toEqual(['tgt']);
    });

    it('one -> one: the target field is the FK', () => {
        expect([...foreignKeyFieldIds([rel('one', 'one')])]).toEqual(['tgt']);
    });

    it('many -> many: the target field is the FK', () => {
        expect([...foreignKeyFieldIds([rel('many', 'many')])]).toEqual(['tgt']);
    });

    it('returns an empty set for no relationships', () => {
        expect(foreignKeyFieldIds([]).size).toBe(0);
    });
});
