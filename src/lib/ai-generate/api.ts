import { authFetch } from '@/lib/sqllab-auth';
import { readSse } from './sse';
import { AiApiError } from './types';
import type {
    AiDialect,
    AiGenerationDetail,
    AiHistoryItem,
    AiUsage,
    GenerateOutcome,
} from './types';

const BASE = '/api/erd2/ai';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function errorFrom(res: Response): Promise<AiApiError> {
    const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        limit?: number;
    };
    return new AiApiError(res.status, body.code ?? 'unknown', body.limit);
}

export async function streamGenerate(args: {
    prompt: string;
    dialect: AiDialect;
    signal?: AbortSignal;
    onDelta: (text: string) => void;
}): Promise<GenerateOutcome> {
    const res = await authFetch(`${BASE}/generate/`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ prompt: args.prompt, dialect: args.dialect }),
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
        return { status: 'generated', generationId, ddl: done.ddl, remaining };
    }
    return {
        status:
            done.status === 'rejected_off_topic'
                ? 'rejected_off_topic'
                : 'provider_error',
        generationId,
        remaining,
    };
}

export async function finalizeGeneration(
    id: string,
    body: {
        status: 'success' | 'parse_failed';
        table_count?: number;
        diagram_id?: string;
    }
): Promise<{ refunded: boolean; remaining: number }> {
    const res = await authFetch(`${BASE}/generations/${id}/finalize/`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
    if (!res.ok) throw await errorFrom(res);
    const data = (await res.json()) as { refunded: boolean; remaining: number };
    return { refunded: data.refunded, remaining: data.remaining };
}

export async function listGenerations(): Promise<{
    usage: AiUsage;
    results: AiHistoryItem[];
}> {
    const res = await authFetch(`${BASE}/generations/`);
    if (!res.ok) throw await errorFrom(res);
    return (await res.json()) as { usage: AiUsage; results: AiHistoryItem[] };
}

export async function getGeneration(id: string): Promise<AiGenerationDetail> {
    const res = await authFetch(`${BASE}/generations/${id}/`);
    if (!res.ok) throw await errorFrom(res);
    return (await res.json()) as AiGenerationDetail;
}

export async function deleteGeneration(id: string): Promise<void> {
    const res = await authFetch(`${BASE}/generations/${id}/`, {
        method: 'DELETE',
    });
    if (!res.ok) throw await errorFrom(res);
}

export type AiErrorKind =
    | 'invalid_prompt'
    | 'cooldown'
    | 'limit_free'
    | 'limit_daily'
    | 'network';

export function aiErrorKind(e: unknown): AiErrorKind | 'aborted' {
    if (e instanceof DOMException && e.name === 'AbortError') {
        return 'aborted';
    }
    if (e instanceof AiApiError) {
        switch (e.code) {
            case 'prompt_too_short':
            case 'prompt_too_long':
                return 'invalid_prompt';
            case 'cooldown':
                return 'cooldown';
            case 'generation_limit':
                return 'limit_free';
            case 'daily_ceiling':
                return 'limit_daily';
        }
    }
    return 'network';
}
