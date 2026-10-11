import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSse } from '../sse';
import {
    aiErrorKind,
    deleteGeneration,
    finalizeGeneration,
    getGeneration,
    listGenerations,
    streamGenerate,
} from '../api';
import { AiApiError } from '../types';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sqllab-auth', () => ({ authFetch }));

const streamOf = (...chunks: string[]) =>
    new ReadableStream<Uint8Array>({
        start(controller) {
            const enc = new TextEncoder();
            chunks.forEach((c) => controller.enqueue(enc.encode(c)));
            controller.close();
        },
    });

// Фейковые ответы: не зависим от того, как happy-dom реализует Response с потоковым телом
const json = (body: unknown, status = 200) =>
    ({
        ok: status < 400,
        status,
        json: async () => body,
    }) as unknown as Response;

const streamRes = (...chunks: string[]) =>
    ({
        ok: true,
        status: 200,
        body: streamOf(...chunks),
    }) as unknown as Response;

beforeEach(() => authFetch.mockReset());

describe('readSse', () => {
    it('parses events split across network chunks', async () => {
        const events: unknown[] = [];
        for await (const ev of readSse(
            streamOf(
                'data: {"delta": "CRE',
                'ATE"}\n\ndata: {"done": true}\n',
                '\n'
            )
        )) {
            events.push(ev);
        }
        expect(events).toEqual([{ delta: 'CREATE' }, { done: true }]);
    });

    it('ignores malformed and non-data lines', async () => {
        const events: unknown[] = [];
        for await (const ev of readSse(
            streamOf(': ping\n\ndata: oops\n\ndata: {"a":1}\n\n')
        )) {
            events.push(ev);
        }
        expect(events).toEqual([{ a: 1 }]);
    });
});

describe('streamGenerate', () => {
    it('posts prompt+dialect, forwards deltas and returns the done event', async () => {
        authFetch.mockResolvedValue(
            streamRes(
                'data: {"delta": "CREATE TABLE a ("}\n\n',
                'data: {"delta": "id int);"}\n\n',
                'data: {"done": true, "generation_id": "g1", "status": "generated", "ddl": "CREATE TABLE a (id int);", "remaining": 2}\n\n'
            )
        );
        const deltas: string[] = [];
        const out = await streamGenerate({
            prompt: 'школа',
            dialect: 'mysql',
            onDelta: (d) => deltas.push(d),
        });
        expect(deltas.join('')).toBe('CREATE TABLE a (id int);');
        expect(out).toEqual({
            status: 'generated',
            generationId: 'g1',
            ddl: 'CREATE TABLE a (id int);',
            remaining: 2,
        });
        const [url, init] = authFetch.mock.calls[0];
        expect(url).toBe('/api/erd2/ai/generate/');
        expect(JSON.parse(init.body)).toEqual({
            prompt: 'школа',
            dialect: 'mysql',
        });
    });

    it('returns rejected_off_topic without ddl', async () => {
        authFetch.mockResolvedValue(
            streamRes(
                'data: {"done": true, "generation_id": "g2", "status": "rejected_off_topic", "remaining": 3}\n\n'
            )
        );
        const out = await streamGenerate({
            prompt: 'погода',
            dialect: 'postgresql',
            onDelta: () => undefined,
        });
        expect(out).toEqual({
            status: 'rejected_off_topic',
            generationId: 'g2',
            remaining: 3,
        });
    });

    it('throws AiApiError with code and limit on HTTP errors', async () => {
        authFetch.mockResolvedValue(
            json({ code: 'generation_limit', limit: 3 }, 403)
        );
        await expect(
            streamGenerate({
                prompt: 'школа',
                dialect: 'mysql',
                onDelta: () => undefined,
            })
        ).rejects.toMatchObject({
            status: 403,
            code: 'generation_limit',
            limit: 3,
        });
    });

    it('throws stream_interrupted when the stream ends without a done event', async () => {
        authFetch.mockResolvedValue(streamRes('data: {"delta": "CREATE"}\n\n'));
        await expect(
            streamGenerate({
                prompt: 'школа',
                dialect: 'mysql',
                onDelta: () => undefined,
            })
        ).rejects.toMatchObject({ code: 'stream_interrupted' });
    });
});

describe('history api', () => {
    it('finalizes a generation', async () => {
        authFetch.mockResolvedValue(
            json({ ok: true, refunded: false, remaining: 1 })
        );
        const out = await finalizeGeneration('g1', {
            status: 'success',
            table_count: 4,
            diagram_id: 'd1',
        });
        expect(out).toEqual({ refunded: false, remaining: 1 });
        const [url, init] = authFetch.mock.calls[0];
        expect(url).toBe('/api/erd2/ai/generations/g1/finalize/');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({
            status: 'success',
            table_count: 4,
            diagram_id: 'd1',
        });
    });

    it('lists generations with usage', async () => {
        authFetch.mockResolvedValue(
            json({
                usage: {
                    tier: 'free',
                    kind: 'lifetime',
                    limit: 3,
                    used: 1,
                    remaining: 2,
                },
                results: [],
            })
        );
        const out = await listGenerations();
        expect(out.usage.remaining).toBe(2);
        expect(authFetch.mock.calls[0][0]).toBe('/api/erd2/ai/generations/');
    });

    it('gets one generation and deletes it', async () => {
        authFetch.mockResolvedValueOnce(
            json({
                id: 'g1',
                prompt: 'p',
                dialect: 'mysql',
                table_count: 2,
                ddl: 'CREATE TABLE a (id int);',
                created_at: 'x',
            })
        );
        expect((await getGeneration('g1')).ddl).toContain('CREATE TABLE');
        authFetch.mockResolvedValueOnce(json({ ok: true }));
        await deleteGeneration('g1');
        expect(authFetch.mock.calls[1][0]).toBe('/api/erd2/ai/generations/g1/');
        expect(authFetch.mock.calls[1][1].method).toBe('DELETE');
    });

    it('throws AiApiError on a failed list', async () => {
        authFetch.mockResolvedValue(json({}, 500));
        await expect(listGenerations()).rejects.toBeInstanceOf(AiApiError);
    });
});

describe('aiErrorKind', () => {
    it('maps backend codes to UI error kinds', () => {
        expect(aiErrorKind(new AiApiError(400, 'prompt_too_short'))).toBe(
            'invalid_prompt'
        );
        expect(aiErrorKind(new AiApiError(400, 'prompt_too_long'))).toBe(
            'invalid_prompt'
        );
        expect(aiErrorKind(new AiApiError(429, 'cooldown'))).toBe('cooldown');
        expect(aiErrorKind(new AiApiError(403, 'generation_limit', 3))).toBe(
            'limit_free'
        );
        expect(aiErrorKind(new AiApiError(429, 'daily_ceiling', 30))).toBe(
            'limit_daily'
        );
        expect(aiErrorKind(new AiApiError(401, 'not_authenticated'))).toBe(
            'auth'
        );
        expect(aiErrorKind(new AiApiError(403, 'forbidden'))).toBe('auth');
        expect(aiErrorKind(new AiApiError(500, 'whatever'))).toBe('network');
        expect(aiErrorKind(new TypeError('Failed to fetch'))).toBe('network');
        expect(aiErrorKind(new DOMException('aborted', 'AbortError'))).toBe(
            'aborted'
        );
    });
});
