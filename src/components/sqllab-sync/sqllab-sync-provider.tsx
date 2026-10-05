import { useEffect, useRef } from 'react';
import type React from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { toast } from '@/components/toast/use-toast';
import { trackEvent } from '@/lib/sqllab-account';
import {
    emitSyncNotice,
    emitSyncStatus,
    onSyncNow,
} from '@/lib/sync-status-events';

const SYNC_DEBOUNCE_MS = 2000;
const API_BASE = '/api/erd2/diagrams';

const FREE_TABLES = 10;

interface PushResult {
    ok: boolean;
    status: number;
    code?: string;
    // Состояние схемы на сервере после записи (спека: поле locked в ответе POST/PATCH).
    locked: boolean;
    created: boolean;
}

async function readBody(
    res: Response
): Promise<{ code?: string; locked?: boolean } | null> {
    return (await res
        .clone()
        .json()
        .catch(() => null)) as { code?: string; locked?: boolean } | null;
}

// null — запись не нужна (аноним).
async function pushDiagram(
    diagramId: string,
    title: string,
    content: unknown
): Promise<PushResult | null> {
    // Аноним не залогинен — сохранять на бэкенде нечего и некуда, не шлём запрос.
    if (!getAccessToken()) return null;

    const payload = JSON.stringify({ id: diagramId, title, content });
    const headers = { 'Content-Type': 'application/json' };
    let created = false;
    let res = await authFetch(`${API_BASE}/${diagramId}/`, {
        method: 'PATCH',
        headers,
        body: payload,
    });

    // Диаграммы ещё нет на бэкенде (первое сохранение) — создаём.
    if (res.status === 404) {
        created = true;
        res = await authFetch(`${API_BASE}/`, {
            method: 'POST',
            headers,
            body: payload,
        });
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
        return { ok: false, status: 401, locked: false, created };
    }

    const body = await readBody(res);
    if (!res.ok) {
        console.error(
            `sqllab-sync: не удалось сохранить диаграмму — статус ${res.status}${body?.code ? ` (${body.code})` : ''}`
        );
    }
    return {
        ok: res.ok,
        status: res.status,
        code: body?.code,
        locked: body?.locked === true,
        created,
    };
}

// Результат записи → событие воронки и, в момент пересечения порога, подсказка в индикаторе.
// Пересечение: открытая схема стала закрытой (false → true) или новая создана сразу закрытой.
// Схему, которую мы ни разу не видели открытой (PATCH старой закрытой), не комментируем.
function reportResult(
    result: PushResult,
    diagramId: string,
    tables: number,
    lockedState: Map<string, boolean>
): void {
    trackEvent('erd2_sync_result', window.location.pathname, {
        ok: result.ok,
        tables,
        status: result.status,
        code: result.code,
    });
    if (!result.ok) return;

    const previous = lockedState.get(diagramId);
    lockedState.set(diagramId, result.locked);
    if (!result.locked) return;
    if (previous !== false && !result.created) return;

    const reason = tables > FREE_TABLES ? 'tables' : 'diagrams';
    trackEvent('erd2_over_limit_notice', window.location.pathname, {
        tables,
        reason,
    });
    emitSyncNotice({ kind: 'over_limit', reason });
}

export const SqllabSyncProvider: React.FC = () => {
    const { diagramId, currentDiagram } = useChartDB();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncingRef = useRef(false);
    // Устанавливается, когда triggerSync заблокирован уже идущим синком — сигнал
    // «после завершения текущего синка нужно немедленно повторить с самыми свежими данными».
    const pendingRef = useRef(false);
    // Последнее известное серверное locked-состояние по схемам (для подсказки при пересечении порога).
    const lockedStateRef = useRef(new Map<string, boolean>());
    // Обновляется на каждый рендер, чтобы triggerSync (в т.ч. при трейлинг-ретрае
    // из .finally()) всегда читал актуальные diagramId/currentDiagram, а не то,
    // что было замкнуто в момент планирования дебаунса.
    const latestRef = useRef({ diagramId, currentDiagram });
    latestRef.current = { diagramId, currentDiagram };

    useEffect(() => {
        const canSync = (): boolean => {
            const { diagramId, currentDiagram } = latestRef.current;
            return (
                !!diagramId &&
                !!getAccessToken() &&
                !!currentDiagram.tables &&
                currentDiagram.tables.length > 0
            );
        };

        const triggerSync = () => {
            if (syncingRef.current) {
                pendingRef.current = true;
                return;
            }
            if (!canSync()) return;

            syncingRef.current = true;
            emitSyncStatus('syncing');

            const { diagramId, currentDiagram } = latestRef.current;
            const tables = currentDiagram.tables?.length ?? 0;
            let ok = true;
            pushDiagram(diagramId, currentDiagram.name, currentDiagram)
                .then((result) => {
                    if (!result) return;
                    ok = result.ok;
                    reportResult(
                        result,
                        diagramId,
                        tables,
                        lockedStateRef.current
                    );
                })
                .catch((err: unknown) => {
                    ok = false;
                    console.error(
                        'sqllab-sync: сетевая ошибка при сохранении диаграммы',
                        err
                    );
                    trackEvent('erd2_sync_result', window.location.pathname, {
                        ok: false,
                        tables,
                        status: 0,
                        code: 'network',
                    });
                })
                .finally(() => {
                    syncingRef.current = false;
                    emitSyncStatus(ok ? 'idle' : 'error');
                    // Пока синк был в процессе, пришёл ещё один запрос на синк —
                    // повторяем немедленно на самых свежих данных, чтобы не
                    // потерять правки, сделанные во время сохранения.
                    if (pendingRef.current) {
                        pendingRef.current = false;
                        triggerSync();
                    }
                });
        };

        const offSyncNow = onSyncNow(() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            triggerSync();
        });

        if (!canSync()) return offSyncNow;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(triggerSync, SYNC_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            offSyncNow();
        };
    }, [diagramId, currentDiagram]);

    return null;
};
