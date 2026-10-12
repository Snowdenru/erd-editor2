import { currentPage } from '@/lib/ai-generate/format';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { trackEvent } from '@/lib/sqllab-account';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import { isLoggedIn } from '@/lib/sqllab-account';
import { finalizeGeneration, listGenerations } from '@/lib/ai-generate/api';
import type { AiErrorKind } from '@/lib/ai-generate/api';
import {
    isRefineDialectSupported,
    toApiDialect,
} from '@/lib/ai-generate/dialect';
import { sanitizeDdlForAi } from '@/lib/ai-generate/sanitize-ddl';
import { diffDiagrams } from '@/lib/ai-generate/diagram-diff';
import type { DiagramDiff } from '@/lib/ai-generate/diagram-diff';
import { ddlToDiagram } from '@/lib/ai-generate/import-ddl';
import { mergeAiDiagram } from '@/lib/ai-generate/merge-diagram';
import { refineErrorKind, streamRefine } from '@/lib/ai-generate/refine-api';
import { AiApiError } from '@/lib/ai-generate/types';
import type { AiRefineMode, AiUsage } from '@/lib/ai-generate/types';
import type { Diagram } from '@/lib/domain/diagram';

export type RefinePhase = 'idle' | 'running' | 'review' | 'applying';
export type RefineUiError =
    | AiErrorKind
    | 'too_large'
    | 'too_many_tables'
    | 'unsupported_dialect'
    | 'empty_diagram'
    | 'provider'
    | 'parse'
    | 'apply'
    | 'incomplete';
export type RefineNotice = 'schema_changed';
// Исход возврата попытки: «неизвестно» — когда сервер не ответил или попытка уже закрыта
export type RefundState = 'refunded' | 'denied' | 'unknown';
export type UndoResult = 'done' | 'needs_confirm' | 'failed';

export interface RefineProposal {
    mode: AiRefineMode;
    generationId: string;
    diagramId: string;
    changes: string[];
    diff: DiagramDiff;
    proposed: Diagram;
    // Схема на момент запуска: если к применению она изменилась, предложение пересчитывается
    base: Diagram;
    // Импорт того самого DDL, что был отправлен ИИ: к схеме применяется только разница с ответом
    importBase: Diagram;
}

export interface AiRefineApi {
    phase: RefinePhase;
    error: RefineUiError | null;
    refundState: RefundState;
    errorLimit: number | null;
    notice: RefineNotice | null;
    usage: AiUsage | null;
    proposal: RefineProposal | null;
    noChanges: boolean;
    canUndo: boolean;
    run: (mode: AiRefineMode, instruction?: string) => Promise<void>;
    apply: () => Promise<void>;
    discard: () => Promise<void>;
    undo: (force?: boolean) => Promise<UndoResult>;
    cancel: () => void;
    clearError: () => void;
}

export function useAiRefine(): AiRefineApi {
    const { currentDiagram, updateDiagramData } = useChartDB();
    const diagramRef = useRef(currentDiagram);
    diagramRef.current = currentDiagram;

    const [phase, setPhase] = useState<RefinePhase>('idle');
    const [error, setError] = useState<RefineUiError | null>(null);
    const [refundState, setRefundState] = useState<RefundState>('refunded');
    const [errorLimit, setErrorLimit] = useState<number | null>(null);
    const [notice, setNotice] = useState<RefineNotice | null>(null);
    const [usage, setUsage] = useState<AiUsage | null>(null);
    const [proposal, setProposal] = useState<RefineProposal | null>(null);
    const [noChanges, setNoChanges] = useState(false);
    const [undoState, setUndoState] = useState<{
        before: Diagram;
        after: Diagram;
    } | null>(null);

    const busyRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    // Синхронный источник истины для предложения: state отстаёт от повторных вызовов
    const proposalRef = useRef<RefineProposal | null>(null);
    const putProposal = useCallback((p: RefineProposal | null) => {
        proposalRef.current = p;
        setProposal(p);
    }, []);

    useEffect(() => {
        if (!isLoggedIn()) return;
        listGenerations()
            .then((data) => setUsage(data.usage))
            .catch(() => undefined);
    }, []);

    const setRemaining = useCallback((remaining: number) => {
        setUsage((u) =>
            u ? { ...u, remaining, used: Math.max(0, u.limit - remaining) } : u
        );
    }, []);

    const fail = useCallback(
        (
            kind: RefineUiError,
            mode: AiRefineMode,
            refunded: RefundState = 'refunded',
            limit: number | null = null
        ) => {
            setError(kind);
            setRefundState(refunded);
            setErrorLimit(limit);
            setPhase('idle');
            if (kind === 'limit_free' || kind === 'limit_daily') {
                trackEvent('erd2_ai_limit_wall', currentPage(), {
                    reason: kind,
                    kind: mode,
                });
            } else {
                trackEvent('erd2_ai_fail', currentPage(), {
                    reason: kind,
                    kind: mode,
                });
            }
        },
        []
    );

    const refund = useCallback(
        async (generationId: string): Promise<RefundState> => {
            // Сбой сети или уже закрытая попытка — исход неизвестен, «лимит исчерпан» тут утверждать нельзя
            return finalizeGeneration(generationId, { status: 'parse_failed' })
                .then((r): RefundState => {
                    setRemaining(r.remaining);
                    return r.refunded ? 'refunded' : 'denied';
                })
                .catch((): RefundState => 'unknown');
        },
        [setRemaining]
    );

    const finishCharged = useCallback(
        async (generationId: string, tableCount: number) => {
            await finalizeGeneration(generationId, {
                status: 'success',
                table_count: tableCount,
            }).catch(() => undefined);
        },
        []
    );

    // Предложение закрыто без применения (отказ, смена схемы): попытка списывается
    const settleDropped = useCallback(
        async (p: RefineProposal) => {
            await finishCharged(p.generationId, p.proposed.tables?.length ?? 0);
            trackEvent('erd2_ai_success', currentPage(), {
                kind: p.mode,
                applied: false,
                changes: p.changes.length,
            });
        },
        [finishCharged]
    );

    // Панель размонтируется при смене раздела сайдбара: незакрытая попытка списывается
    const unmountedRef = useRef(false);
    useEffect(() => {
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
            abortRef.current?.abort();
            const dropped = proposalRef.current;
            if (dropped) {
                proposalRef.current = null;
                void settleDropped(dropped);
            }
        };
    }, [settleDropped]);

    // Предложение, откат и запрос относятся к конкретной схеме: при переключении сбрасываем
    useEffect(() => {
        abortRef.current?.abort();
        const dropped = proposalRef.current;
        if (dropped) void settleDropped(dropped);
        putProposal(null);
        setUndoState(null);
        setNoChanges(false);
        setError(null);
        setRefundState('refunded');
        setErrorLimit(null);
        setNotice(null);
        setPhase((p) => (p === 'review' ? 'idle' : p));
    }, [currentDiagram.id, putProposal, settleDropped]);

    const run = useCallback(
        async (mode: AiRefineMode, instruction = '') => {
            if (busyRef.current || proposalRef.current) return;
            const current = diagramRef.current;
            const startId = current.id;
            setError(null);
            setRefundState('refunded');
            setErrorLimit(null);
            setNotice(null);
            setNoChanges(false);
            if (!current.tables?.length) {
                setError('empty_diagram');
                return;
            }
            // Типы и синтаксис Oracle, ClickHouse и т.п. модель честно не поймёт: молча считать их PostgreSQL нельзя
            if (!isRefineDialectSupported(current.databaseType)) {
                fail('unsupported_dialect', mode);
                return;
            }
            busyRef.current = true;
            const controller = new AbortController();
            abortRef.current = controller;
            setPhase('running');

            const dialect = toApiDialect(current.databaseType);
            trackEvent('erd2_ai_start', currentPage(), { dialect, kind: mode });
            try {
                const ddl = sanitizeDdlForAi(
                    exportBaseSQL({
                        diagram: current,
                        targetDatabaseType: current.databaseType,
                    }),
                    dialect
                );
                const outcome = await streamRefine({
                    mode,
                    ddl,
                    dialect,
                    instruction,
                    signal: controller.signal,
                    onDelta: () => undefined,
                });
                if (unmountedRef.current) {
                    if (outcome.status === 'generated') {
                        await finishCharged(
                            outcome.generationId,
                            current.tables.length
                        );
                        trackEvent('erd2_ai_success', currentPage(), {
                            kind: mode,
                            applied: false,
                            changes: outcome.changes.length,
                        });
                    }
                    return;
                }
                setRemaining(outcome.remaining);
                if (diagramRef.current.id !== startId) {
                    // Схему сменили, пока шёл запрос: результат показать некому
                    if (outcome.status === 'generated') {
                        await finishCharged(
                            outcome.generationId,
                            current.tables.length
                        );
                    }
                    setPhase('idle');
                    return;
                }
                if (outcome.status === 'provider_error') {
                    fail('provider', mode);
                    return;
                }
                if (outcome.status === 'no_changes') {
                    setNoChanges(true);
                    setPhase('idle');
                    trackEvent('erd2_ai_success', currentPage(), {
                        kind: mode,
                        applied: false,
                        changes: 0,
                    });
                    return;
                }

                let next: Diagram;
                let importBase: Diagram;
                let diff: DiagramDiff;
                let incomplete = false;
                try {
                    // Оба импорта идут через один и тот же разбор: его потери в разнице взаимно сокращаются
                    importBase = await ddlToDiagram({
                        ddl,
                        dialect,
                        prompt: current.name,
                    });
                    next = await ddlToDiagram({
                        ddl: sanitizeDdlForAi(outcome.ddl, dialect),
                        dialect,
                        prompt: current.name,
                    });
                    // Показываем ровно то, что будет применено: дифф от результата слияния
                    diff = diffDiagrams(
                        current,
                        mergeAiDiagram(current, next, importBase)
                    );
                    const removed = diff.tables.filter(
                        (t) => t.status === 'removed'
                    ).length;
                    const total = (current.tables ?? []).filter(
                        (t) => !t.isView
                    ).length;
                    incomplete =
                        removed > Math.max(2, Math.floor(total * 0.25));
                } catch {
                    const refunded = await refund(outcome.generationId);
                    if (unmountedRef.current) return;
                    if (diagramRef.current.id !== startId) {
                        setPhase('idle');
                        return;
                    }
                    fail('parse', mode, refunded);
                    return;
                }
                if (incomplete) {
                    const refunded = await refund(outcome.generationId);
                    if (unmountedRef.current) return;
                    if (diagramRef.current.id !== startId) {
                        setPhase('idle');
                        return;
                    }
                    fail('incomplete', mode, refunded);
                    return;
                }
                if (unmountedRef.current) {
                    await finishCharged(
                        outcome.generationId,
                        current.tables.length
                    );
                    trackEvent('erd2_ai_success', currentPage(), {
                        kind: mode,
                        applied: false,
                        changes: outcome.changes.length,
                    });
                    return;
                }
                if (diagramRef.current.id !== startId) {
                    await finishCharged(
                        outcome.generationId,
                        current.tables.length
                    );
                    setPhase('idle');
                    return;
                }
                if (diff.isEmpty) {
                    await finishCharged(
                        outcome.generationId,
                        current.tables.length
                    );
                    setNoChanges(true);
                    setPhase('idle');
                    trackEvent('erd2_ai_success', currentPage(), {
                        kind: mode,
                        applied: false,
                        changes: 0,
                    });
                    return;
                }
                putProposal({
                    mode,
                    generationId: outcome.generationId,
                    diagramId: current.id,
                    changes: outcome.changes,
                    diff,
                    proposed: next,
                    base: current,
                    importBase,
                });
                setPhase('review');
            } catch (e) {
                if (unmountedRef.current) return;
                const kind = refineErrorKind(e);
                if (kind === 'aborted') {
                    setPhase('idle');
                } else if (kind === 'too_large' && e instanceof AiApiError) {
                    // limit приходит только когда превышено число таблиц тарифа
                    fail(
                        e.limit != null ? 'too_many_tables' : 'too_large',
                        mode,
                        'refunded',
                        e.limit ?? null
                    );
                } else {
                    fail(kind, mode);
                }
            } finally {
                busyRef.current = false;
                abortRef.current = null;
            }
        },
        [fail, finishCharged, putProposal, refund, setRemaining]
    );

    const apply = useCallback(async () => {
        if (busyRef.current) return;
        const p = proposalRef.current;
        if (!p) return;
        const snapshot = diagramRef.current;
        if (snapshot.id !== p.diagramId) {
            putProposal(null);
            await settleDropped(p);
            setPhase('idle');
            return;
        }
        if (!diffDiagrams(p.base, snapshot).isEmpty) {
            // Схему правили, пока открыто предложение: пересчитываем и просим подтвердить заново
            let fresh: DiagramDiff;
            try {
                fresh = diffDiagrams(
                    snapshot,
                    mergeAiDiagram(snapshot, p.proposed, p.importBase)
                );
            } catch {
                putProposal(null);
                busyRef.current = true;
                try {
                    const refunded = await refund(p.generationId);
                    fail('apply', p.mode, refunded);
                } finally {
                    busyRef.current = false;
                }
                return;
            }
            if (fresh.isEmpty) {
                putProposal(null);
                await finishCharged(
                    p.generationId,
                    p.proposed.tables?.length ?? 0
                );
                setNotice(null);
                setNoChanges(true);
                setPhase('idle');
                trackEvent('erd2_ai_success', currentPage(), {
                    kind: p.mode,
                    applied: false,
                    changes: 0,
                });
                return;
            }
            putProposal({ ...p, base: snapshot, diff: fresh });
            setNotice('schema_changed');
            return;
        }
        putProposal(null);
        setNotice(null);
        busyRef.current = true;
        setPhase('applying');
        try {
            let merged: Diagram;
            try {
                merged = mergeAiDiagram(snapshot, p.proposed, p.importBase);
                await updateDiagramData(merged);
            } catch {
                // Запись могла пройти частично: возвращаем прежнее состояние
                await updateDiagramData(snapshot).catch(() => undefined);
                const refunded = await refund(p.generationId);
                fail('apply', p.mode, refunded);
                return;
            }
            await finishCharged(p.generationId, merged.tables?.length ?? 0);
            trackEvent('erd2_ai_success', currentPage(), {
                kind: p.mode,
                applied: true,
                changes: p.changes.length,
            });
            if (diagramRef.current.id === snapshot.id) {
                setUndoState({ before: snapshot, after: merged });
            }
            setPhase('idle');
        } finally {
            busyRef.current = false;
        }
    }, [
        fail,
        finishCharged,
        putProposal,
        refund,
        settleDropped,
        updateDiagramData,
    ]);

    const discard = useCallback(async () => {
        if (busyRef.current) return;
        const p = proposalRef.current;
        if (!p) return;
        putProposal(null);
        setNotice(null);
        setPhase('idle');
        await settleDropped(p);
    }, [putProposal, settleDropped]);

    // Возвращает снимок до применения. Если схему правили после применения, эти правки пропадут:
    // без force сначала просим подтверждение. Снимок сбрасывается эффектом по id схемы.
    const undo = useCallback(
        async (force = false): Promise<UndoResult> => {
            if (!undoState || busyRef.current) return 'failed';
            if (diagramRef.current.id !== undoState.before.id) {
                setUndoState(null);
                return 'failed';
            }
            if (
                !force &&
                !diffDiagrams(undoState.after, diagramRef.current).isEmpty
            ) {
                return 'needs_confirm';
            }
            busyRef.current = true;
            try {
                await updateDiagramData(undoState.before);
                setUndoState(null);
                return 'done';
            } catch {
                setError('apply');
                return 'failed';
            } finally {
                busyRef.current = false;
            }
        },
        [undoState, updateDiagramData]
    );

    const cancel = useCallback(() => abortRef.current?.abort(), []);
    const clearError = useCallback(() => {
        setError(null);
        setRefundState('refunded');
        setErrorLimit(null);
    }, []);

    return {
        phase,
        error,
        refundState,
        errorLimit,
        notice,
        usage,
        proposal,
        noChanges,
        canUndo: undoState !== null,
        run,
        apply,
        discard,
        undo,
        cancel,
        clearError,
    };
}
