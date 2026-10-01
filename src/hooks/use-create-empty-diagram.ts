import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/hooks/use-storage';
import { useConfig } from '@/hooks/use-config';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { generateDiagramId } from '@/lib/utils';
import { diagramPath } from '@/lib/erd-paths';

export function useCreateEmptyDiagram() {
    const navigate = useNavigate();
    const { addDiagram, listDiagrams, listTables } = useStorage();
    const { config, updateConfig } = useConfig();

    const createEmptyDiagram = useCallback(
        async (options?: { replace?: boolean; reuseEmptyLast?: boolean }) => {
            if (options?.reuseEmptyLast && config?.defaultDiagramId) {
                const lastId = config.defaultDiagramId;
                const diagrams = await listDiagrams();
                if (diagrams.some((d) => d.id === lastId)) {
                    const tables = await listTables(lastId);
                    if (tables.length === 0) {
                        const lastPath = diagramPath(lastId);
                        if (options.replace) {
                            navigate(lastPath, { replace: true });
                        } else {
                            navigate(lastPath);
                        }
                        return;
                    }
                }
            }

            const existingDiagrams = await listDiagrams();
            const now = new Date();
            const diagram: Diagram = {
                id: generateDiagramId(),
                name: `Diagram ${existingDiagrams.length + 1}`,
                databaseType: DatabaseType.POSTGRESQL,
                createdAt: now,
                updatedAt: now,
            };

            await addDiagram({ diagram });
            await updateConfig({ config: { defaultDiagramId: diagram.id } });
            const path = diagramPath(diagram.id);
            if (options?.replace) {
                navigate(path, { replace: true });
            } else {
                navigate(path);
            }
        },
        [addDiagram, listDiagrams, listTables, config, updateConfig, navigate]
    );

    return { createEmptyDiagram };
}
