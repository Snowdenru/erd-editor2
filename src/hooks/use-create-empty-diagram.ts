import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/hooks/use-storage';
import { useConfig } from '@/hooks/use-config';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { generateDiagramId } from '@/lib/utils';

export function useCreateEmptyDiagram() {
    const navigate = useNavigate();
    const { addDiagram, listDiagrams } = useStorage();
    const { updateConfig } = useConfig();

    const createEmptyDiagram = useCallback(async () => {
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
        navigate(`/diagrams/${diagram.id}`);
    }, [addDiagram, listDiagrams, updateConfig, navigate]);

    return { createEmptyDiagram };
}
