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
    const { addDiagram, listDiagrams, getDiagram } = useStorage();
    const { config, updateConfig } = useConfig();

    const createEmptyDiagram = useCallback(
        async (options?: { replace?: boolean; reuseEmptyLast?: boolean }) => {
            if (options?.reuseEmptyLast && config?.defaultDiagramId) {
                const lastId = config.defaultDiagramId;
                const last = await getDiagram(lastId, {
                    includeTables: true,
                    includeRelationships: true,
                    includeDependencies: true,
                    includeAreas: true,
                    includeCustomTypes: true,
                    includeNotes: true,
                });
                // «Пустая» — совсем ничего нет: заметка или область тоже работа пользователя.
                const isEmpty =
                    !!last &&
                    !last.tables?.length &&
                    !last.relationships?.length &&
                    !last.areas?.length &&
                    !last.notes?.length &&
                    !last.customTypes?.length &&
                    !last.dependencies?.length;
                if (isEmpty) {
                    const lastPath = diagramPath(lastId);
                    if (options.replace) {
                        navigate(lastPath, { replace: true });
                    } else {
                        navigate(lastPath);
                    }
                    return;
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
        [addDiagram, listDiagrams, getDiagram, config, updateConfig, navigate]
    );

    return { createEmptyDiagram };
}
