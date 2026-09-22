import { useEffect, useRef } from 'react';
import type React from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { toast } from '@/components/toast/use-toast';
import { emitUpgradeWall } from '@/lib/upgrade-wall-events';
import { emitSyncStatus, onSyncNow } from '@/lib/sync-status-events';

const SYNC_DEBOUNCE_MS = 2000;
const API_BASE = '/api/erd2/diagrams';

// 403 с кодом лимита тарифа — показываем стену апгрейда; иначе обычный тост «доступ запрещён».
async function handleSaveFailure(res: Response): Promise<void> {
    const body = (await res
        .clone()
        .json()
        .catch(() => null)) as {
        code?: string;
        limit?: number;
    } | null;

    if (body?.code === 'diagram_limit' || body?.code === 'table_limit') {
        console.error(
            `sqllab-sync: не удалось сохранить диаграмму — лимит тарифа (${body.code})`
        );
        emitUpgradeWall({ reason: body.code, limit: body.limit });
        return;
    }

    console.error(
        'sqllab-sync: не удалось сохранить диаграмму — доступ запрещён (403)'
    );
    toast({
        title: 'Diagram not saved',
        variant: 'destructive',
        description: 'You have reached the diagram limit for your plan.',
    });
}

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
        const createRes = await authFetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: diagramId, title, content }),
        });

        // Бэкенд шлёт diagram_limit только на создании (POST) — здесь, а не на PATCH.
        if (createRes.status === 403) {
            await handleSaveFailure(createRes);
            return;
        }

        if (!createRes.ok) {
            console.error(
                `sqllab-sync: не удалось создать диаграмму — бэкенд ответил статусом ${createRes.status}`
            );
        }
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
        await handleSaveFailure(res);
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
        const canSync =
            !!diagramId &&
            !!getAccessToken() &&
            !!currentDiagram.tables &&
            currentDiagram.tables.length > 0;

        const triggerSync = () => {
            emitSyncStatus('syncing');
            pushDiagram(diagramId, currentDiagram.name, currentDiagram)
                .catch((err: unknown) => {
                    console.error(
                        'sqllab-sync: сетевая ошибка при сохранении диаграммы',
                        err
                    );
                })
                .finally(() => emitSyncStatus('idle'));
        };

        const offSyncNow = onSyncNow(() => {
            if (!canSync) return;
            if (timerRef.current) clearTimeout(timerRef.current);
            triggerSync();
        });

        if (!canSync) return offSyncNow;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(triggerSync, SYNC_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            offSyncNow();
        };
    }, [diagramId, currentDiagram]);

    return null;
};
