import { sqlImportToDiagram } from '@/lib/data/sql-import';
import type { Diagram } from '@/lib/domain/diagram';
import { toDatabaseType } from './dialect';
import { titleFromPrompt } from './format';
import type { AiDialect } from './types';

export async function ddlToDiagram({
    ddl,
    dialect,
    prompt,
}: {
    ddl: string;
    dialect: AiDialect;
    prompt: string;
}): Promise<Diagram> {
    const type = toDatabaseType(dialect);
    const diagram = await sqlImportToDiagram({
        sqlContent: ddl,
        sourceDatabaseType: type,
        targetDatabaseType: type,
    });
    if (!diagram.tables?.length) {
        throw new Error('no_tables');
    }
    const now = new Date();
    return {
        ...diagram,
        name: titleFromPrompt(prompt),
        createdAt: now,
        updatedAt: now,
    };
}
