import type { DBRelationship } from '@/lib/domain/db-relationship';

// FK — поле со стороны «много»; если обе стороны одинаковы, считаем внешним ключом целевое поле
export const foreignKeyFieldIds = (
    relationships: DBRelationship[]
): Set<string> =>
    new Set(
        relationships.map((rel) =>
            rel.sourceCardinality === 'many' && rel.targetCardinality !== 'many'
                ? rel.sourceFieldId
                : rel.targetFieldId
        )
    );
