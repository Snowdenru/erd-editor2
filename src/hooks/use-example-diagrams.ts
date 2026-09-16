import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/hooks/use-storage';
import type { Diagram } from '@/lib/domain/diagram';
import type { Example } from '@/pages/examples-page/examples-data/examples-data';
import { examples } from '@/pages/examples-page/examples-data/examples-data';

export function useExampleDiagrams() {
    const navigate = useNavigate();
    const { addDiagram, deleteDiagram } = useStorage();
    const [loadingExampleId, setLoadingExampleId] = useState<string>();

    const utilizeExample = useCallback(
        async ({ example }: { example: Example }) => {
            if (loadingExampleId) {
                return;
            }
            setLoadingExampleId(example.id);
            try {
                const { diagram } = example;
                const { id } = diagram;

                await deleteDiagram(id);

                const now = new Date();
                const diagramToAdd: Diagram = {
                    ...diagram,
                    createdAt: now,
                    updatedAt: now,
                };

                await addDiagram({ diagram: diagramToAdd });
                navigate(`/diagrams/${id}`);
            } finally {
                setLoadingExampleId(undefined);
            }
        },
        [addDiagram, navigate, deleteDiagram, loadingExampleId]
    );

    return { examples, loadingExampleId, utilizeExample };
}
