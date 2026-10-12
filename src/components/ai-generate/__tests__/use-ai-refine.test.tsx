import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diagram, field, table } from '@/lib/ai-generate/__tests__/fixtures';
import { AiApiError } from '@/lib/ai-generate/types';

const streamRefine = vi.hoisted(() => vi.fn());
const finalizeGeneration = vi.hoisted(() => vi.fn());
const listGenerations = vi.hoisted(() => vi.fn());
const ddlToDiagram = vi.hoisted(() => vi.fn());
const updateDiagramData = vi.hoisted(() => vi.fn());
const trackEvent = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/lib/ai-generate/refine-api', async () => {
    const actual = await vi.importActual('@/lib/ai-generate/refine-api');
    return { ...actual, streamRefine };
});
vi.mock('@/lib/ai-generate/api', async () => {
    const actual = await vi.importActual('@/lib/ai-generate/api');
    return { ...actual, finalizeGeneration, listGenerations };
});
vi.mock('@/lib/ai-generate/merge-diagram', async () => {
    const actual = await vi.importActual<{
        mergeAiDiagram: (...a: unknown[]) => unknown;
    }>('@/lib/ai-generate/merge-diagram');
    return { ...actual, mergeAiDiagram: vi.fn(actual.mergeAiDiagram) };
});
vi.mock('@/lib/ai-generate/import-ddl', () => ({ ddlToDiagram }));
vi.mock('@/lib/sqllab-account', () => ({ trackEvent }));
vi.mock('@/lib/data/sql-export/export-sql-script', () => ({
    exportBaseSQL: () => 'CREATE TABLE users (id int);',
}));
vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ currentDiagram: state.current, updateDiagramData }),
}));

import { mergeAiDiagram } from '@/lib/ai-generate/merge-diagram';
import { useAiRefine } from '../use-ai-refine';

const current = diagram([
    table('users', [field('id')], { id: 'u', x: 10, y: 20 }),
]);
const proposed = diagram([
    table('users', [field('id'), field('email')], { id: 'p-u' }),
]);

beforeEach(() => {
    vi.clearAllMocks();
    state.current = current;
    listGenerations.mockResolvedValue({
        usage: {
            tier: 'free',
            kind: 'lifetime',
            limit: 3,
            used: 1,
            remaining: 2,
        },
        results: [],
    });
    finalizeGeneration.mockResolvedValue({ refunded: false, remaining: 2 });
    updateDiagramData.mockResolvedValue(undefined);
});

const generated = {
    status: 'generated',
    generationId: 'g1',
    ddl: 'CREATE TABLE users (id int, email text);',
    changes: ['добавлен email'],
    remaining: 1,
};

describe('useAiRefine', () => {
    it('loads usage on mount', async () => {
        const { result } = renderHook(() => useAiRefine());
        await waitFor(() => expect(result.current.usage?.remaining).toBe(2));
    });

    it('runs a review and ends in the review phase with a diff', async () => {
        streamRefine.mockResolvedValue(generated);
        ddlToDiagram.mockResolvedValue(proposed);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.phase).toBe('review');
        expect(result.current.proposal?.changes).toEqual(['добавлен email']);
        expect(result.current.proposal?.diff.tables[0].addedFields).toEqual([
            'email',
        ]);
        expect(streamRefine).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'review',
                dialect: 'postgresql',
                ddl: 'CREATE TABLE users (id int);',
            })
        );
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_ai_start',
            expect.any(String),
            expect.objectContaining({ kind: 'review' })
        );
    });

    it('applies the proposal in place, finalizes success and allows undo', async () => {
        streamRefine.mockResolvedValue(generated);
        ddlToDiagram.mockResolvedValue(proposed);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('edit', 'добавь email');
        });
        await act(async () => {
            await result.current.apply();
        });
        const applied = updateDiagramData.mock.calls[0][0];
        expect(applied.tables[0]).toMatchObject({ id: 'u', x: 10, y: 20 });
        expect(
            applied.tables[0].fields.map((f: { name: string }) => f.name)
        ).toEqual(['id', 'email']);
        expect(finalizeGeneration).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({ status: 'success' })
        );
        expect(result.current.phase).toBe('idle');
        expect(result.current.proposal).toBeNull();
        expect(result.current.canUndo).toBe(true);

        await act(async () => {
            await result.current.undo();
        });
        expect(updateDiagramData).toHaveBeenLastCalledWith(current);
        expect(result.current.canUndo).toBe(false);
    });

    it('discard keeps the schema untouched but still finalizes success', async () => {
        streamRefine.mockResolvedValue(generated);
        ddlToDiagram.mockResolvedValue(proposed);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        await act(async () => {
            await result.current.discard();
        });
        expect(updateDiagramData).not.toHaveBeenCalled();
        expect(finalizeGeneration).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({ status: 'success' })
        );
        expect(result.current.proposal).toBeNull();
    });

    it('shows noChanges for a no_changes outcome and for an empty diff', async () => {
        streamRefine.mockResolvedValueOnce({
            status: 'no_changes',
            generationId: 'g2',
            remaining: 1,
        });
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.noChanges).toBe(true);
        expect(result.current.phase).toBe('idle');

        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockResolvedValueOnce(current);
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.noChanges).toBe(true);
        expect(finalizeGeneration).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({ status: 'success' })
        );
    });

    it('refunds the attempt when the model DDL cannot be parsed', async () => {
        streamRefine.mockResolvedValue(generated);
        ddlToDiagram.mockRejectedValue(new Error('sanity'));
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });
        expect(result.current.error).toBe('parse');
        expect(result.current.phase).toBe('idle');
    });

    it('rolls back and refunds when writing the merged diagram fails', async () => {
        streamRefine.mockResolvedValue(generated);
        ddlToDiagram.mockResolvedValue(proposed);
        updateDiagramData
            .mockRejectedValueOnce(new Error('db'))
            .mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        await act(async () => {
            await result.current.apply();
        });
        expect(updateDiagramData).toHaveBeenLastCalledWith(current);
        expect(finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });
        expect(result.current.error).toBe('apply');
        expect(result.current.phase).toBe('idle');
        expect(result.current.proposal).toBeNull();
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
    });

    it('maps API errors and tracks the limit wall', async () => {
        streamRefine.mockRejectedValue(
            new AiApiError(403, 'generation_limit', 3)
        );
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('limit_free');
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_ai_limit_wall',
            expect.any(String),
            expect.objectContaining({ kind: 'review' })
        );
    });

    it('refuses to run on an empty diagram without calling the API', async () => {
        state.current = diagram([]);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('empty_diagram');
        expect(streamRefine).not.toHaveBeenCalled();
    });
});

const successCalls = () =>
    finalizeGeneration.mock.calls.filter((c) => c[1].status === 'success');

const deferred = <T,>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

const toReview = async (result: {
    current: ReturnType<typeof useAiRefine>;
}) => {
    streamRefine.mockResolvedValueOnce(generated);
    ddlToDiagram.mockResolvedValueOnce(proposed);
    await act(async () => {
        await result.current.run('review');
    });
};

describe('useAiRefine state machine', () => {
    it('apply that throws in mergeAiDiagram refunds once and releases busy', async () => {
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        vi.mocked(mergeAiDiagram).mockImplementationOnce(() => {
            throw new Error('merge');
        });
        await act(async () => {
            await result.current.apply();
        });
        expect(result.current.phase).toBe('idle');
        expect(result.current.error).toBe('apply');
        expect(result.current.proposal).toBeNull();
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });

        streamRefine.mockResolvedValueOnce({
            ...generated,
            generationId: 'g2',
        });
        ddlToDiagram.mockResolvedValueOnce(proposed);
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.phase).toBe('review');
    });

    it('ignores run() while a proposal is pending', async () => {
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        await act(async () => {
            await result.current.run('review');
        });
        expect(streamRefine).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe('review');
    });

    it('settles a pending proposal once when the diagram is switched', async () => {
        const { result, rerender } = renderHook(() => useAiRefine());
        await toReview(result);
        state.current = diagram(
            [table('orders', [field('id')], { id: 'o' })],
            [],
            { id: 'd2' }
        );
        rerender();
        await waitFor(() => expect(result.current.proposal).toBeNull());
        expect(result.current.phase).toBe('idle');
        expect(successCalls()).toHaveLength(1);
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_ai_success',
            expect.any(String),
            expect.objectContaining({ applied: false })
        );
    });

    it('aborts on switch during running and settles a late result once', async () => {
        const d = deferred<typeof generated>();
        streamRefine.mockReturnValueOnce(d.promise);
        const { result, rerender } = renderHook(() => useAiRefine());
        let running!: Promise<void>;
        act(() => {
            running = result.current.run('review');
        });
        const signal = streamRefine.mock.calls[0][0].signal as AbortSignal;
        expect(signal.aborted).toBe(false);
        state.current = diagram([table('orders', [field('id')])], [], {
            id: 'd2',
        });
        rerender();
        expect(signal.aborted).toBe(true);
        await act(async () => {
            d.resolve(generated);
            await running;
        });
        expect(result.current.proposal).toBeNull();
        expect(result.current.phase).toBe('idle');
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(ddlToDiagram).not.toHaveBeenCalled();
    });

    it('discard twice finalizes once', async () => {
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        await act(async () => {
            await Promise.all([
                result.current.discard(),
                result.current.discard(),
            ]);
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
    });

    it('discard then apply finalizes once and does not write', async () => {
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        await act(async () => {
            await Promise.all([
                result.current.discard(),
                result.current.apply(),
            ]);
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(updateDiagramData).not.toHaveBeenCalled();
    });

    it('discard during applying is ignored', async () => {
        const w = deferred<void>();
        updateDiagramData.mockReturnValueOnce(w.promise);
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        let applying!: Promise<void>;
        act(() => {
            applying = result.current.apply();
        });
        await act(async () => {
            await result.current.discard();
        });
        await act(async () => {
            w.resolve();
            await applying;
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
    });

    it('aborts the in-flight request on unmount', async () => {
        const d = deferred<typeof generated>();
        streamRefine.mockReturnValueOnce(d.promise);
        const { result, unmount } = renderHook(() => useAiRefine());
        act(() => {
            void result.current.run('review');
        });
        const signal = streamRefine.mock.calls[0][0].signal as AbortSignal;
        unmount();
        expect(signal.aborted).toBe(true);
    });

    it('cancel() with an AbortError returns to idle without an error', async () => {
        streamRefine.mockRejectedValueOnce(new DOMException('x', 'AbortError'));
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.phase).toBe('idle');
        expect(result.current.error).toBeNull();
    });

    it('maps provider_error and the daily ceiling', async () => {
        streamRefine.mockResolvedValueOnce({
            status: 'provider_error',
            remaining: 2,
        });
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('provider');

        streamRefine.mockRejectedValueOnce(
            new AiApiError(429, 'daily_ceiling')
        );
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('limit_daily');
    });

    it('tracks erd2_ai_success with applied true after apply and false after discard', async () => {
        const { result } = renderHook(() => useAiRefine());
        await toReview(result);
        await act(async () => {
            await result.current.apply();
        });
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_ai_success',
            expect.any(String),
            {
                kind: 'review',
                applied: true,
                changes: 1,
            }
        );
        await toReview(result);
        await act(async () => {
            await result.current.discard();
        });
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_ai_success',
            expect.any(String),
            {
                kind: 'review',
                applied: false,
                changes: 1,
            }
        );
    });
});
