import { useEffect, useRef } from 'react';
import type React from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { toast } from '@/components/toast/use-toast';

const SYNC_DEBOUNCE_MS = 2000;
const API_BASE = '/api/erd2/diagrams';

async function pushDiagram(diagramId: string, title: string, content: unknown) {
    // Аноним не залогинен — сохранять на бэкенде нечего и некуда, не шлём запрос.
    if (!getAccessToken()) return;

    const res = await authFetch(`${API_BASE}/${diagramId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: diagramId, title, content }),
    });

    // Диаграммы ещё нет на бэкенде (первое сохранение) — создаём.
    if (res.status === 404) {
        await authFetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: diagramId, title, content }),
        });
        return;
    }

    if (res.status === 401) {
        console.error(
            'sqllab-sync: не удалось сохранить диаграмму — сессия истекла (401), нужен повторный вход'
        );
        toast({
            title: 'Diagram not saved',
            variant: 'destructive',
            description:
                'Your session has expired. Please sign in again to keep syncing changes.',
        });
        return;
    }

    if (res.status === 403) {
        console.error(
            'sqllab-sync: не удалось сохранить диаграмму — достигнут лимит диаграмм текущего тарифа (403)'
        );
        toast({
            title: 'Diagram not saved',
            variant: 'destructive',
            description: 'You have reached the diagram limit for your plan.',
        });
        return;
    }

    if (!res.ok) {
        console.error(
            `sqllab-sync: не удалось сохранить диаграмму — бэкенд ответил статусом ${res.status}`
        );
    }
}

export const SqllabSyncProvider: React.FC = () => {
    const { diagramId, currentDiagram } = useChartDB();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!diagramId) return;
        // Не залогинен — синхронизировать нечего, не заводим даже таймер.
        if (!getAccessToken()) return;
        // Пустая диаграмма (без единой таблицы) не расходует квоту тарифа —
        // синхронизация начнётся только после первой добавленной таблицы.
        if (!currentDiagram.tables || currentDiagram.tables.length === 0)
            return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            pushDiagram(diagramId, currentDiagram.name, currentDiagram).catch(
                (err: unknown) => {
                    console.error(
                        'sqllab-sync: сетевая ошибка при сохранении диаграммы',
                        err
                    );
                }
            );
        }, SYNC_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [diagramId, currentDiagram]);

    return null;
};
