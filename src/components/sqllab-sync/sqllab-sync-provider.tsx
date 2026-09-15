import { useEffect, useRef } from 'react';
import type React from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { authFetch } from '@/lib/sqllab-auth';

const SYNC_DEBOUNCE_MS = 2000;
const API_BASE = '/api/erd2/diagrams';

async function pushDiagram(diagramId: string, title: string, content: unknown) {
    await authFetch(`${API_BASE}/${diagramId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: diagramId, title, content }),
    }).then(async (res) => {
        // Диаграммы ещё нет на бэкенде (первое сохранение) — создаём.
        if (res.status === 404) {
            await authFetch(`${API_BASE}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: diagramId, title, content }),
            });
        }
    });
}

export const SqllabSyncProvider: React.FC = () => {
    const { diagramId, currentDiagram } = useChartDB();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!diagramId) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            void pushDiagram(diagramId, currentDiagram.name, currentDiagram);
        }, SYNC_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [diagramId, currentDiagram]);

    return null;
};
