import { useEffect, useRef } from 'react';
import type React from 'react';
import { useStorage } from '@/hooks/use-storage';
import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { toast } from '@/components/toast/use-toast';
import { generateId } from '@/lib/utils/utils';
import {
    planPull,
    reviveDiagram,
    splitRows,
    type CloudDiagramRow,
} from '@/lib/cloud-diagrams';
import { setLockedCards } from '@/lib/locked-diagrams';
import type { Diagram } from '@/lib/domain/diagram';

const LOCAL_INCLUDE = {
    includeTables: true,
    includeRelationships: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
};

// Ничего не рисует: один раз за загрузку страницы подтягивает облачные схемы залогиненного
// пользователя в локальное хранилище. Ошибки глотаем — редактор работает и без облака.
export const CloudPullProvider: React.FC = () => {
    const { listDiagrams, addDiagram, deleteDiagram } = useStorage();
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current || !getAccessToken()) return;
        startedRef.current = true;

        const run = async () => {
            const res = await authFetch('/api/erd2/diagrams/');
            if (!res.ok) return;
            const rows = (await res.json()) as CloudDiagramRow[];
            const { open, locked } = splitRows(rows);
            const localDiagrams = await listDiagrams(LOCAL_INCLUDE);

            // Карточка нужна только для строк, которых нет в IndexedDB: если локальная копия
            // есть, схема открывается как обычно, при любом тарифе.
            const localIds = new Set(localDiagrams.map((d) => d.id));
            setLockedCards(locked.filter((card) => !localIds.has(card.id)));

            const cloud = open
                .map(reviveDiagram)
                .filter((d): d is Diagram => d !== null);
            if (cloud.length === 0) return;

            const actions = planPull(cloud, localDiagrams);
            let replaced = 0;
            for (const action of actions) {
                if (action.kind === 'replace') {
                    // Сначала копия, потом удаление: при сбое посередине локальная схема не пропадёт.
                    await addDiagram({
                        diagram: {
                            ...action.backupOf,
                            id: generateId(),
                            name: `${action.backupOf.name} (локальная копия)`,
                        },
                    });
                    await deleteDiagram(action.backupOf.id);
                    replaced += 1;
                }
                await addDiagram({ diagram: action.diagram });
            }
            if (actions.length > 0) {
                toast({
                    title: `Загружено схем из облака: ${actions.length}`,
                    description:
                        replaced > 0
                            ? 'Локальные версии сохранены как копии.'
                            : undefined,
                });
            }
        };

        run().catch((err: unknown) => {
            console.error(
                'cloud-pull: не удалось загрузить схемы из облака',
                err
            );
        });
    }, [listDiagrams, addDiagram, deleteDiagram]);

    return null;
};
