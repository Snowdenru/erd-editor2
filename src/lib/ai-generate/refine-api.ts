import { authFetch } from '@/lib/sqllab-auth';
import { aiErrorKind, errorFrom } from './api';
import type { AiErrorKind } from './api';
import { readSse } from './sse';
import { AiApiError } from './types';
import type { AiDialect, AiRefineMode, RefineOutcome } from './types';

const URL = '/api/erd2/ai/refine/';

export async function streamRefine(args: {
    mode: AiRefineMode;
    ddl: string;
    dialect: AiDialect;
    instruction?: string;
    signal?: AbortSignal;
    onDelta: (text: string) => void;
}): Promise<RefineOutcome> {
    const res = await authFetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: args.mode,
            ddl: args.ddl,
            dialect: args.dialect,
            ...(args.instruction ? { instruction: args.instruction } : {}),
        }),
        signal: args.signal,
    });
    if (!res.ok || !res.body) {
        throw await errorFrom(res);
    }

    let done: Record<string, unknown> | undefined;
    for await (const event of readSse(res.body)) {
        if (typeof event.delta === 'string') {
            args.onDelta(event.delta);
        }
        if (event.done === true) {
            done = event;
        }
    }
    if (!done) {
        throw new AiApiError(0, 'stream_interrupted');
    }

    const generationId = String(done.generation_id);
    const remaining = Number(done.remaining ?? 0);
    if (done.status === 'generated' && typeof done.ddl === 'string') {
        const changes = Array.isArray(done.changes)
            ? done.changes.filter((c): c is string => typeof c === 'string')
            : [];
        return {
            status: 'generated',
            generationId,
            ddl: done.ddl,
            changes,
            remaining,
        };
    }
    if (done.status === 'no_changes') {
        return { status: 'no_changes', generationId, remaining };
    }
    return { status: 'provider_error', generationId, remaining };
}

export function refineErrorKind(
    e: unknown
): AiErrorKind | 'aborted' | 'too_large' | 'empty_diagram' {
    if (e instanceof AiApiError && e.code === 'too_large') return 'too_large';
    if (e instanceof AiApiError && e.code === 'ddl_empty') {
        return 'empty_diagram';
    }
    return aiErrorKind(e);
}
