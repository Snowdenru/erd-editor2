import { useChartDB } from '@/hooks/use-chartdb';
import { useConfig } from '@/hooks/use-config';
import { useCreateEmptyDiagram } from '@/hooks/use-create-empty-diagram';
import { useDialog } from '@/hooks/use-dialog';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useRedoUndoStack } from '@/hooks/use-redo-undo-stack';
import { useStorage } from '@/hooks/use-storage';
import type { Diagram } from '@/lib/domain/diagram';
import { useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import { NEW_DIAGRAM_PATH, diagramPath } from '@/lib/erd-paths';

export const useDiagramLoader = () => {
    const [initialDiagram, setInitialDiagram] = useState<Diagram | undefined>();
    const { diagramId } = useParams<{ diagramId: string }>();
    const isNewRoute = !!useMatch(NEW_DIAGRAM_PATH);
    const { config } = useConfig();
    const { loadDiagram, currentDiagram } = useChartDB();
    const { resetRedoStack, resetUndoStack } = useRedoUndoStack();
    const { showLoader, hideLoader } = useFullScreenLoader();
    const { openOpenDiagramDialog } = useDialog();
    const { createEmptyDiagram } = useCreateEmptyDiagram();
    const navigate = useNavigate();
    const { listDiagrams } = useStorage();

    const currentDiagramLoadingRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!config) {
            return;
        }

        if (currentDiagram?.id === diagramId) {
            return;
        }

        const loadDefaultDiagram = async () => {
            if (diagramId) {
                setInitialDiagram(undefined);
                showLoader();
                resetRedoStack();
                resetUndoStack();
                const diagram = await loadDiagram(diagramId);
                if (!diagram) {
                    openOpenDiagramDialog({ canClose: false });
                    hideLoader();
                    return;
                }

                setInitialDiagram(diagram);
                hideLoader();

                return;
            }

            // /new (в т.ч. с глубокой ссылкой ?open=import / ?tab=…) открывает пустой холст:
            // переиспользуем пустую последнюю схему, чтобы не плодить пустые в списке.
            if (isNewRoute) {
                await createEmptyDiagram({
                    replace: true,
                    reuseEmptyLast: true,
                });
                return;
            }

            if (config.defaultDiagramId) {
                const diagram = await loadDiagram(config.defaultDiagramId);
                if (diagram) {
                    navigate(diagramPath(config.defaultDiagramId), {
                        replace: true,
                    });

                    return;
                }
            }
            const diagrams = await listDiagrams();

            if (diagrams.length > 0) {
                openOpenDiagramDialog({ canClose: false });
            } else {
                await createEmptyDiagram();
            }
        };

        // /new и /diagrams оба без diagramId, но ведут себя по-разному: ключ различает их,
        // иначе переход /diagrams → /new без перемонтирования пропустил бы создание схемы.
        const loadingKey = `${isNewRoute ? 'new:' : ''}${diagramId ?? ''}`;
        if (
            currentDiagramLoadingRef.current === loadingKey &&
            currentDiagramLoadingRef.current !== undefined
        ) {
            return;
        }
        currentDiagramLoadingRef.current = loadingKey;

        loadDefaultDiagram();
    }, [
        diagramId,
        isNewRoute,
        createEmptyDiagram,
        config,
        navigate,
        listDiagrams,
        loadDiagram,
        resetRedoStack,
        resetUndoStack,
        hideLoader,
        showLoader,
        currentDiagram?.id,
        openOpenDiagramDialog,
    ]);

    return { initialDiagram };
};
