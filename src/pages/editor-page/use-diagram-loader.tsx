import { useChartDB } from '@/hooks/use-chartdb';
import { useConfig } from '@/hooks/use-config';
import { useCreateEmptyDiagram } from '@/hooks/use-create-empty-diagram';
import { useDialog } from '@/hooks/use-dialog';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useRedoUndoStack } from '@/hooks/use-redo-undo-stack';
import { useStorage } from '@/hooks/use-storage';
import type { Diagram } from '@/lib/domain/diagram';
import { useEffect, useRef, useState } from 'react';
import {
    useLocation,
    useMatch,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { NEW_DIAGRAM_PATH, diagramPath } from '@/lib/erd-paths';
import { setLastDiagramId } from '@/lib/last-diagram';
import { getLockedCards } from '@/lib/locked-diagrams';
import { isPullPending, whenPullSettled } from '@/lib/cloud-pull-state';

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
    const { search } = useLocation();
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
                let diagram = await loadDiagram(diagramId);
                if (!diagram && isPullPending()) {
                    // Схема может прийти из облака прямо сейчас (новое устройство, чистый профиль).
                    await whenPullSettled();
                    diagram = await loadDiagram(diagramId);
                }
                if (!diagram) {
                    // Закрытая схема: поверх показывается LockedDiagramScreen, диалог
                    // открытия схемы ему не нужен.
                    if (getLockedCards().some((c) => c.id === diagramId)) {
                        hideLoader();
                        return;
                    }
                    openOpenDiagramDialog({ canClose: false });
                    hideLoader();
                    return;
                }

                // Маркер быстрого входа пишем здесь, а не только в ConfigProvider: шаблоны,
                // DDL-блок лендинга и прямые /d/:id не меняют config.defaultDiagramId.
                setLastDiagramId(diagramId);
                setInitialDiagram(diagram);
                hideLoader();

                return;
            }

            // Глубокие ссылки лендинга (?open=import, ?tab=…) открывают диалог/вкладку поверх
            // последней схемы: пустую схему под них не создаём (импорт создаёт свою новую,
            // а пустая осталась бы в списке сиротой).
            const params = new URLSearchParams(search);
            const hasDeepLink =
                params.get('open') === 'import' || params.has('tab');
            // Обычный /new открывает пустой холст: переиспользуем пустую последнюю схему,
            // чтобы не плодить пустые в списке.
            if (isNewRoute && !hasDeepLink) {
                await createEmptyDiagram({
                    replace: true,
                    reuseEmptyLast: true,
                });
                return;
            }

            if (config.defaultDiagramId) {
                const diagram = await loadDiagram(config.defaultDiagramId);
                if (diagram) {
                    setLastDiagramId(config.defaultDiagramId);
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
        search,
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
