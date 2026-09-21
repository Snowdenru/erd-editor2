import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/hooks/use-storage';
import type { Diagram } from '@/lib/domain/diagram';
import type { Example } from '@/pages/examples-page/examples-data/examples-data';
import { examples } from '@/pages/examples-page/examples-data/examples-data';
import { cloneDiagram } from '@/lib/clone';

export function useExampleDiagrams() {
    const navigate = useNavigate();
    const { addDiagram } = useStorage();
    const [loadingExampleId, setLoadingExampleId] = useState<string>();

    const utilizeExample = useCallback(
        async ({ example }: { example: Example }) => {
            if (loadingExampleId) {
                return;
            }
            setLoadingExampleId(example.id);
            try {
                // Каждый клик — независимая копия с новыми id: иначе примеры затирали друг друга
                // (у всех был один id), а на бэкенде id диаграммы глобально уникален
                const { diagram } = cloneDiagram(example.diagram);

                const now = new Date();
                const diagramToAdd: Diagram = {
                    ...example.diagram,
                    ...diagram,
                    createdAt: now,
                    updatedAt: now,
                };

                await addDiagram({ diagram: diagramToAdd });
                navigate(`/diagrams/${diagramToAdd.id}`);
            } finally {
                setLoadingExampleId(undefined);
            }
        },
        [addDiagram, navigate, loadingExampleId]
    );

    return { examples, loadingExampleId, utilizeExample };
}
