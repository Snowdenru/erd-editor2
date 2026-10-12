import { useCallback, useEffect, useRef, useState } from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { trackEvent } from '@/lib/sqllab-account';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import { finalizeGeneration, listGenerations } from '@/lib/ai-generate/api';
import type { AiErrorKind } from '@/lib/ai-generate/api';
import { toApiDialect } from '@/lib/ai-generate/dialect';
import { sanitizeDdlForAi } from '@/lib/ai-generate/sanitize-ddl';
import { diffDiagrams } from '@/lib/ai-generate/diagram-diff';
import type { DiagramDiff } from '@/lib/ai-generate/diagram-diff';
import { ddlToDiagram } from '@/lib/ai-generate/import-ddl';
import { mergeAiDiagram } from '@/lib/ai-generate/merge-diagram';
import { refineErrorKind, streamRefine } from '@/lib/ai-generate/refine-api';
import type { AiRefineMode, AiUsage } from '@/lib/ai-generate/types';
import type { Diagram } from '@/lib/domain/diagram';

export type RefinePhase = 'idle' | 'running' | 'review' | 'applying';
export type RefineUiError =
    | AiErrorKind
    | 'too_large'
    | 'empty_diagram'
    | 'provider'
    | 'parse'
    | 'apply'
    | 'incomplete';
export type RefineNotice = 'schema_changed';

export interface RefineProposal {
    mode: AiRefineMode;
    generationId: string;
    diagramId: string;
    changes: string[];
    diff: DiagramDiff;
    proposed: Diagram;
    // Схема на момент запуска: если к применению она изменилась, предложение пересчитывается
    base: Diagram;
}

export interface AiRefineApi {
    phase: RefinePhase;
    error: RefineUiError | null;
    refundDenied: boolean;
    notice: RefineNotice | null;
    usage: AiUsage | null;
    proposal: RefineProposal | null;
    noChanges: boolean;
    canUndo: boolean;
    run: (mode: AiRefineMode, instruction?: string) => Promise<void>;
    apply: () => Promise<void>;
    discard: () => Promise<void>;
    undo: () => Promise<void>;
    cancel: () => void;
    clearError: () => void;
}

const page = () => window.location.pathname;

export function useAiRefine(): AiRefineApi {
    const { currentDiagram, updateDiagramData } = useChartDB();
    const diagramRef = useRef(currentDiagram);
    diagramRef.current = currentDiagram;

    const [phase, setPhase] = useState<RefinePhase>('idle');
    const [error, setError] = useState<RefineUiError | null>(null);
    const [refundDenied, setRefundDenied] = useState(false);
    const [notice, setNotice] = useState<RefineNotice | null>(null);
    const [usage, setUsage] = useState<AiUsage | null>(null);
    const [proposal, setProposal] = useState<RefineProposal | null>(null);
    const [noChanges, setNoChanges] = useState(false);
    const [undoSnapshot, setUndoSnapshot] = useState<Diagram | null>(null);

    const busyRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    // Синхронный источник истины для предложения: state отстаёт от повторных вызовов
    const proposalRef = useRef<RefineProposal | null>(null);
    const putProposal = useCallback((p: RefineProposal | null) => {
        proposalRef.current = p;
        setProposal(p);
    }, []);

    useEffect(() => {
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
        (kind: RefineUiError, mode: AiRefineMode, refunded?: boolean) => {
            setError(kind);
            setRefundDenied(refunded === false);
            setPhase('idle');
            if (kind === 'limit_free' || kind === 'limit_daily') {
                trackEvent('erd2_ai_limit_wall', page(), {
                    reason: kind,
                    kind: mode,
                });
            } else {
                trackEvent('erd2_ai_fail', page(), {
                    reason: kind,
                    kind: mode,
                });
            }
        },
        []
    );

    const refund = useCallback(
        async (generationId: string): Promise<boolean> => {
            // Сбой сети — исход неизвестен, считаем, что возврата нет
            return finalizeGeneration(generationId, { status: 'parse_failed' })
                .then((r) => {
                    setRemaining(r.remaining);
                    return r.refunded;
                })
                .catch(() => false);
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
            trackEvent('erd2_ai_success', page(), {
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
        setUndoSnapshot(null);
        setNoChanges(false);
        setError(null);
        setRefundDenied(false);
        setNotice(null);
        setPhase((p) => (p === 'review' ? 'idle' : p));
    }, [currentDiagram.id, putProposal, settleDropped]);

    const run = useCallback(
        async (mode: AiRefineMode, instruction = '') => {
            if (busyRef.current || proposalRef.current) return;
            const current = diagramRef.current;
            const startId = current.id;
            setError(null);
            setRefundDenied(false);
            setNotice(null);
            setNoChanges(false);
            setUndoSnapshot(null);
            if (!current.tables?.length) {
                setError('empty_diagram');
                return;
            }
            busyRef.current = true;
            const controller = new AbortController();
            abortRef.current = controller;
            setPhase('running');

            const dialect = toApiDialect(current.databaseType);
            trackEvent('erd2_ai_start', page(), { dialect, kind: mode });
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
                        trackEvent('erd2_ai_success', page(), {
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
                    trackEvent('erd2_ai_success', page(), {
                        kind: mode,
                        applied: false,
                        changes: 0,
                    });
                    return;
                }

                let next: Diagram;
                let diff: DiagramDiff;
                let incomplete = false;
                try {
                    next = await ddlToDiagram({
                        ddl: outcome.ddl,
                        dialect,
                        prompt: current.name,
                    });
                    // Показываем ровно то, что будет применено: дифф от результата слияния
                    diff = diffDiagrams(current, mergeAiDiagram(current, next));
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
                    trackEvent('erd2_ai_success', page(), {
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
                    trackEvent('erd2_ai_success', page(), {
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
                });
                setPhase('review');
            } catch (e) {
                if (unmountedRef.current) return;
                const kind = refineErrorKind(e);
                if (kind === 'aborted') {
                    setPhase('idle');
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
                    mergeAiDiagram(snapshot, p.proposed)
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
                trackEvent('erd2_ai_success', page(), {
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
                merged = mergeAiDiagram(snapshot, p.proposed);
                await updateDiagramData(merged);
            } catch {
                // Запись могла пройти частично: возвращаем прежнее состояние
                await updateDiagramData(snapshot).catch(() => undefined);
                const refunded = await refund(p.generationId);
                fail('apply', p.mode, refunded);
                return;
            }
            await finishCharged(p.generationId, merged.tables?.length ?? 0);
            trackEvent('erd2_ai_success', page(), {
                kind: p.mode,
                applied: true,
                changes: p.changes.length,
            });
            if (diagramRef.current.id === snapshot.id) {
                setUndoSnapshot(snapshot);
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

    // Возвращает снимок до применения и перезаписывает правки, сделанные после него
    // (при смене схемы снимок сбрасывается эффектом по id схемы).
    const undo = useCallback(async () => {
        if (!undoSnapshot) return;
        if (diagramRef.current.id !== undoSnapshot.id) {
            setUndoSnapshot(null);
            return;
        }
        try {
            await updateDiagramData(undoSnapshot);
            setUndoSnapshot(null);
        } catch {
            setError('apply');
        }
    }, [undoSnapshot, updateDiagramData]);

    const cancel = useCallback(() => abortRef.current?.abort(), []);
    const clearError = useCallback(() => {
        setError(null);
        setRefundDenied(false);
    }, []);

    return {
        phase,
        error,
        refundDenied,
        notice,
        usage,
        proposal,
        noChanges,
        canUndo: undoSnapshot !== null,
        run,
        apply,
        discard,
        undo,
        cancel,
        clearError,
    };
}
