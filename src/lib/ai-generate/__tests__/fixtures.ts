import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBTable } from '@/lib/domain/db-table';

export const field = (name: string, extra: Partial<DBField> = {}): DBField => ({
    id: `f-${name}`,
    name,
    type: { id: 'integer', name: 'integer' },
    primaryKey: false,
    unique: false,
    nullable: true,
    createdAt: 1,
    ...extra,
});

export const table = (
    name: string,
    fields: DBField[],
    extra: Partial<DBTable> = {}
): DBTable => ({
    id: `t-${name}`,
    name,
    x: 0,
    y: 0,
    fields,
    indexes: [],
    color: '#8eb7ff',
    isView: false,
    createdAt: 1,
    ...extra,
});

export const diagram = (
    tables: DBTable[],
    relationships: DBRelationship[] = [],
    extra: Partial<Diagram> = {}
): Diagram => ({
    id: 'd1',
    name: 'Test',
    databaseType: DatabaseType.POSTGRESQL,
    tables,
    relationships,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...extra,
});

// Связь «source.sourceField → target.targetField» между таблицами, собранными через table()/field()
export const relationship = (
    source: DBTable,
    sourceField: string,
    target: DBTable,
    targetField: string,
    extra: Partial<DBRelationship> = {}
): DBRelationship => ({
    id: `r-${source.name}-${sourceField}-${target.name}-${targetField}`,
    name: `fk_${source.name}_${sourceField}`,
    sourceTableId: source.id,
    targetTableId: target.id,
    sourceFieldId: source.fields.find((f) => f.name === sourceField)!.id,
    targetFieldId: target.fields.find((f) => f.name === targetField)!.id,
    sourceCardinality: 'many',
    targetCardinality: 'one',
    createdAt: 1,
    ...extra,
});
