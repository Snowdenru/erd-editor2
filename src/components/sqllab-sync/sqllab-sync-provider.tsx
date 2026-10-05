import { useEffect, useRef } from 'react';
import type React from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { toast } from '@/components/toast/use-toast';
import { trackEvent } from '@/lib/sqllab-account';
import { getCloudVersion, setCloudVersion } from '@/lib/cloud-versions';
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

interface ResponseBody {
    code?: string;
    locked?: boolean;
    updated_at?: string;
}

async function readBody(res: Response): Promise<ResponseBody | null> {
    return (await res
        .clone()
        .json()
        .catch(() => null)) as ResponseBody | null;
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
    const patchPayload = JSON.stringify({
        id: diagramId,
        title,
        content,
        base_updated_at: getCloudVersion(diagramId),
    });
    const headers = { 'Content-Type': 'application/json' };
    let created = false;
    let res = await authFetch(`${API_BASE}/${diagramId}/`, {
        method: 'PATCH',
        headers,
        body: patchPayload,
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
    if (res.ok && body?.updated_at) setCloudVersion(diagramId, body.updated_at);
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
    lockedState: Map<string, boolean>,
    lastOutcome: { key: string | null }
): void {
    // Событие — про смену исхода, а не про каждое автосохранение: успех повторяется сотни раз.
    const outcome = `${result.ok}:${result.status}:${result.code ?? ''}`;
    if (outcome !== lastOutcome.key) {
        lastOutcome.key = outcome;
        trackEvent('erd2_sync_result', window.location.pathname, {
            ok: result.ok,
            tables,
            status: result.status,
            code: result.code,
        });
    }
    if (!result.ok) {
        if (result.code === 'conflict') emitSyncNotice({ kind: 'conflict' });
        return;
    }

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
    const lastOutcomeRef = useRef<{ key: string | null }>({ key: null });
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
                        lockedStateRef.current,
                        lastOutcomeRef.current
                    );
                })
                .catch((err: unknown) => {
                    ok = false;
                    console.error(
                        'sqllab-sync: сетевая ошибка при сохранении диаграммы',
                        err
                    );
                    if (lastOutcomeRef.current.key !== 'false:0:network') {
                        lastOutcomeRef.current.key = 'false:0:network';
                        trackEvent(
                            'erd2_sync_result',
                            window.location.pathname,
                            { ok: false, tables, status: 0, code: 'network' }
                        );
                    }
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
