import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/hooks/use-storage';
import { useDialog } from '@/hooks/use-dialog';
import { diagramPath } from '@/lib/erd-paths';
import { trackEvent } from '@/lib/sqllab-account';
import {
    aiErrorKind,
    deleteGeneration,
    finalizeGeneration,
    getGeneration,
    listGenerations,
    streamGenerate,
} from '@/lib/ai-generate/api';
import type { AiErrorKind } from '@/lib/ai-generate/api';
import { countCreateTables } from '@/lib/ai-generate/format';
import { ddlToDiagram } from '@/lib/ai-generate/import-ddl';
import type {
    AiDialect,
    AiHistoryItem,
    AiUsage,
} from '@/lib/ai-generate/types';

export type AiPhase = 'idle' | 'generating' | 'importing';
export type AiUiError =
    | AiErrorKind
    | 'off_topic'
    | 'provider'
    | 'parse'
    | 'save';

export interface AiGenerateApi {
    phase: AiPhase;
    ddl: string;
    tableCount: number;
    error: AiUiError | null;
    usage: AiUsage | null;
    history: AiHistoryItem[];
    historyLoaded: boolean;
    generate: (prompt: string, dialect: AiDialect) => Promise<void>;
    cancel: () => void;
    restore: (id: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    reload: () => Promise<void>;
    clearError: () => void;
}

const page = () => window.location.pathname;

export function useAiGenerate(
    options: { onDone?: () => void } = {}
): AiGenerateApi {
    const navigate = useNavigate();
    const { addDiagram } = useStorage();
    const { closeCreateDiagramDialog } = useDialog();

    const [phase, setPhase] = useState<AiPhase>('idle');
    const [ddl, setDdl] = useState('');
    const [tableCount, setTableCount] = useState(0);
    const [error, setError] = useState<AiUiError | null>(null);
    const [usage, setUsage] = useState<AiUsage | null>(null);
    const [history, setHistory] = useState<AiHistoryItem[]>([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    const busyRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const onDoneRef = useRef(options.onDone);
    onDoneRef.current = options.onDone;

    const setRemaining = useCallback((remaining: number) => {
        setUsage((u) =>
            u ? { ...u, remaining, used: Math.max(0, u.limit - remaining) } : u
        );
    }, []);

    const fail = useCallback((kind: AiUiError) => {
        setError(kind);
        setPhase('idle');
        if (kind === 'limit_free' || kind === 'limit_daily') {
            trackEvent('erd2_ai_limit_wall', page(), { reason: kind });
        } else {
            trackEvent('erd2_ai_fail', page(), { reason: kind });
        }
    }, []);

    // Возвращает true, если схема сохранена в браузере
    const saveDiagram = useCallback(
        async (diagram: Awaited<ReturnType<typeof ddlToDiagram>>) => {
            try {
                await addDiagram({ diagram });
                return true;
            } catch {
                return false;
            }
        },
        [addDiagram]
    );

    // Сервер вернёт попытку (в пределах дневного бюджета возвратов)
    const refund = useCallback(
        async (generationId: string) => {
            await finalizeGeneration(generationId, { status: 'parse_failed' })
                .then((r) => setRemaining(r.remaining))
                .catch(() => undefined);
        },
        [setRemaining]
    );

    const openDiagram = useCallback(
        (diagram: Awaited<ReturnType<typeof ddlToDiagram>>) => {
            closeCreateDiagramDialog();
            onDoneRef.current?.();
            navigate(diagramPath(diagram.id));
        },
        [closeCreateDiagramDialog, navigate]
    );

    const generate = useCallback(
        async (prompt: string, dialect: AiDialect) => {
            if (busyRef.current) return;
            busyRef.current = true;
            const controller = new AbortController();
            abortRef.current = controller;
            setError(null);
            setDdl('');
            setTableCount(0);
            setPhase('generating');
            trackEvent('erd2_ai_start', page(), { dialect });

            try {
                let acc = '';
                const outcome = await streamGenerate({
                    prompt,
                    dialect,
                    signal: controller.signal,
                    onDelta: (delta) => {
                        acc += delta;
                        setDdl(acc);
                        setTableCount(countCreateTables(acc));
                    },
                });
                setRemaining(outcome.remaining);
                if (outcome.status === 'rejected_off_topic') {
                    fail('off_topic');
                    return;
                }
                if (outcome.status !== 'generated') {
                    fail('provider');
                    return;
                }

                setPhase('importing');
                let diagram: Awaited<ReturnType<typeof ddlToDiagram>>;
                try {
                    diagram = await ddlToDiagram({
                        ddl: outcome.ddl,
                        dialect,
                        prompt,
                    });
                } catch {
                    await refund(outcome.generationId);
                    fail('parse');
                    return;
                }

                if (!(await saveDiagram(diagram))) {
                    await refund(outcome.generationId);
                    fail('save');
                    return;
                }
                await finalizeGeneration(outcome.generationId, {
                    status: 'success',
                    table_count: diagram.tables?.length ?? 0,
                    diagram_id: diagram.id,
                }).catch(() => undefined);
                trackEvent('erd2_ai_success', page(), {
                    dialect,
                    tables: diagram.tables?.length ?? 0,
                });
                setPhase('idle');
                openDiagram(diagram);
            } catch (e) {
                const kind = aiErrorKind(e);
                if (kind === 'aborted') {
                    setPhase('idle');
                } else {
                    fail(kind);
                }
            } finally {
                busyRef.current = false;
                abortRef.current = null;
            }
        },
        [fail, openDiagram, refund, saveDiagram, setRemaining]
    );

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const restore = useCallback(
        async (id: string) => {
            if (busyRef.current) return;
            busyRef.current = true;
            setError(null);
            setPhase('importing');
            try {
                const saved = await getGeneration(id);
                let diagram: Awaited<ReturnType<typeof ddlToDiagram>>;
                try {
                    diagram = await ddlToDiagram({
                        ddl: saved.ddl,
                        dialect: saved.dialect,
                        prompt: saved.prompt,
                    });
                } catch {
                    fail('parse');
                    return;
                }
                if (!(await saveDiagram(diagram))) {
                    fail('save');
                    return;
                }
                trackEvent('erd2_ai_restore', page(), {});
                setPhase('idle');
                openDiagram(diagram);
            } catch (e) {
                const kind = aiErrorKind(e);
                fail(kind === 'aborted' ? 'network' : kind);
            } finally {
                busyRef.current = false;
            }
        },
        [fail, openDiagram, saveDiagram]
    );

    const reload = useCallback(async () => {
        try {
            const data = await listGenerations();
            setUsage(data.usage);
            setHistory(data.results);
        } catch {
            // история не критична: диалог работает и без неё
        } finally {
            setHistoryLoaded(true);
        }
    }, []);

    const remove = useCallback(async (id: string) => {
        try {
            await deleteGeneration(id);
            setHistory((items) => items.filter((item) => item.id !== id));
        } catch {
            // не удалось скрыть — запись остаётся в списке
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        phase,
        ddl,
        tableCount,
        error,
        usage,
        history,
        historyLoaded,
        generate,
        cancel,
        restore,
        remove,
        reload,
        clearError,
    };
}
