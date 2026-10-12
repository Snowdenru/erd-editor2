import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refineErrorKind, streamRefine } from '../refine-api';
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

const sse = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

beforeEach(() => authFetch.mockReset());

describe('streamRefine', () => {
    it('posts mode, ddl, dialect and instruction', async () => {
        authFetch.mockResolvedValue(
            streamRes(
                sse({
                    done: true,
                    generation_id: 'g1',
                    status: 'no_changes',
                    remaining: 2,
                })
            )
        );
        await streamRefine({
            mode: 'edit',
            ddl: 'CREATE TABLE a (id int);',
            dialect: 'mysql',
            instruction: 'добавь отзывы',
            onDelta: () => undefined,
        });
        const [url, init] = authFetch.mock.calls[0];
        expect(url).toBe('/api/erd2/ai/refine/');
        expect(JSON.parse(init.body)).toEqual({
            mode: 'edit',
            ddl: 'CREATE TABLE a (id int);',
            dialect: 'mysql',
            instruction: 'добавь отзывы',
        });
    });

    it('returns changes and ddl for a generated result and forwards deltas', async () => {
        authFetch.mockResolvedValue(
            streamRes(
                sse({ delta: '-- CHANGE: x' }),
                sse({
                    done: true,
                    generation_id: 'g1',
                    status: 'generated',
                    remaining: 1,
                    changes: ['x'],
                    ddl: 'CREATE TABLE a (id int);',
                })
            )
        );
        const deltas: string[] = [];
        const outcome = await streamRefine({
            mode: 'review',
            ddl: 'd',
            dialect: 'postgresql',
            onDelta: (t) => deltas.push(t),
        });
        expect(deltas).toEqual(['-- CHANGE: x']);
        expect(outcome).toEqual({
            status: 'generated',
            generationId: 'g1',
            remaining: 1,
            changes: ['x'],
            ddl: 'CREATE TABLE a (id int);',
        });
    });

    it('maps no_changes and provider_error', async () => {
        authFetch.mockResolvedValueOnce(
            streamRes(
                sse({
                    done: true,
                    generation_id: 'g1',
                    status: 'no_changes',
                    remaining: 2,
                })
            )
        );
        const a = await streamRefine({
            mode: 'review',
            ddl: 'd',
            dialect: 'postgresql',
            onDelta: () => undefined,
        });
        expect(a).toEqual({
            status: 'no_changes',
            generationId: 'g1',
            remaining: 2,
        });
        authFetch.mockResolvedValueOnce(
            streamRes(
                sse({
                    done: true,
                    generation_id: 'g2',
                    status: 'provider_error',
                    remaining: 3,
                })
            )
        );
        const b = await streamRefine({
            mode: 'review',
            ddl: 'd',
            dialect: 'postgresql',
            onDelta: () => undefined,
        });
        expect(b).toEqual({
            status: 'provider_error',
            generationId: 'g2',
            remaining: 3,
        });
    });

    it('throws AiApiError with the server code on HTTP errors', async () => {
        authFetch.mockResolvedValue(
            json({ code: 'too_large', limit: 10 }, 400)
        );
        const error = await streamRefine({
            mode: 'review',
            ddl: 'd',
            dialect: 'postgresql',
            onDelta: () => undefined,
        }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(AiApiError);
        expect((error as AiApiError).code).toBe('too_large');
        expect(refineErrorKind(error)).toBe('too_large');
    });

    it('throws stream_interrupted when the stream ends without a done event', async () => {
        authFetch.mockResolvedValue(streamRes(sse({ delta: 'x' })));
        await expect(
            streamRefine({
                mode: 'review',
                ddl: 'd',
                dialect: 'postgresql',
                onDelta: () => undefined,
            })
        ).rejects.toMatchObject({ code: 'stream_interrupted' });
    });
});

describe('refineErrorKind', () => {
    it('delegates everything except too_large to aiErrorKind', () => {
        expect(
            refineErrorKind(new AiApiError(403, 'generation_limit', 3))
        ).toBe('limit_free');
        expect(refineErrorKind(new AiApiError(429, 'cooldown'))).toBe(
            'cooldown'
        );
        expect(refineErrorKind(new AiApiError(400, 'ddl_empty'))).toBe(
            'empty_diagram'
        );
        expect(
            refineErrorKind(new AiApiError(400, 'instruction_too_short'))
        ).toBe('invalid_prompt');
        expect(refineErrorKind(new DOMException('x', 'AbortError'))).toBe(
            'aborted'
        );
    });
});
