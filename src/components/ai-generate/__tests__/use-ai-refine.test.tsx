import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diagram, field, table } from '@/lib/ai-generate/__tests__/fixtures';
import { DatabaseType } from '@/lib/domain/database-type';
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
const exportBaseSQL = vi.hoisted(() => vi.fn());
vi.mock('@/lib/data/sql-export/export-sql-script', () => ({ exportBaseSQL }));
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
    exportBaseSQL.mockReturnValue('CREATE TABLE users (id int);');
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
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
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

    it('unmount during review settles the proposal with one success', async () => {
        const { result, unmount } = renderHook(() => useAiRefine());
        await toReview(result);
        unmount();
        await waitFor(() => expect(successCalls()).toHaveLength(1));
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
    });

    it('unmount while streaming settles a late generated outcome once', async () => {
        const d = deferred<typeof generated>();
        streamRefine.mockReturnValueOnce(d.promise);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result, unmount } = renderHook(() => useAiRefine());
        let running!: Promise<void>;
        act(() => {
            running = result.current.run('review');
        });
        unmount();
        expect(finalizeGeneration).not.toHaveBeenCalled();
        await act(async () => {
            d.resolve(generated);
            await running;
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(ddlToDiagram).not.toHaveBeenCalled();
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('unmount while ddlToDiagram is pending settles once', async () => {
        const d = deferred<typeof proposed>();
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockReturnValueOnce(d.promise);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result, unmount } = renderHook(() => useAiRefine());
        let running!: Promise<void>;
        act(() => {
            running = result.current.run('review');
        });
        await waitFor(() => expect(ddlToDiagram).toHaveBeenCalled());
        unmount();
        await act(async () => {
            d.resolve(proposed);
            await running;
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('diagram switch during applying finalizes once and keeps no undo', async () => {
        const w = deferred<void>();
        updateDiagramData.mockReturnValueOnce(w.promise);
        const { result, rerender } = renderHook(() => useAiRefine());
        await toReview(result);
        let applying!: Promise<void>;
        act(() => {
            applying = result.current.apply();
        });
        state.current = diagram([table('orders', [field('id')])], [], {
            id: 'd2',
        });
        rerender();
        await act(async () => {
            w.resolve();
            await applying;
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(result.current.canUndo).toBe(false);
        await act(async () => {
            await result.current.undo();
        });
        expect(updateDiagramData).toHaveBeenCalledTimes(1);
    });

    it('parse failure after a diagram switch refunds once without an error', async () => {
        const d = deferred<typeof proposed>();
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockReturnValueOnce(d.promise);
        const { result, rerender } = renderHook(() => useAiRefine());
        let running!: Promise<void>;
        act(() => {
            running = result.current.run('review');
        });
        await waitFor(() => expect(ddlToDiagram).toHaveBeenCalled());
        state.current = diagram([table('orders', [field('id')])], [], {
            id: 'd2',
        });
        rerender();
        await act(async () => {
            d.reject(new Error('sanity'));
            await running;
        });
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });
        expect(result.current.error).toBeNull();
        expect(result.current.phase).toBe('idle');
    });
});

describe('useAiRefine final wave', () => {
    const idx = (name: string) => ({
        id: `i-${name}`,
        name,
        unique: false,
        fieldIds: ['f-id'],
        createdAt: 1,
    });

    it('shows the diff of the merge result and applies exactly that', async () => {
        const cur = diagram([
            table('users', [field('id')], {
                id: 'u',
                indexes: [idx('ix_users')],
                comments: 'Пользователи',
            }),
        ]);
        state.current = cur;
        const prop = diagram([
            table('users', [field('id'), field('email')], { id: 'p-u' }),
        ]);
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockResolvedValueOnce(prop);
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        const d = result.current.proposal!.diff;
        expect(d.tables).toHaveLength(1);
        expect(d.tables[0].removedIndexes).toEqual([]);
        expect(d.tables[0].addedFields).toEqual(['email']);
        await act(async () => {
            await result.current.apply();
        });
        expect(updateDiagramData.mock.calls[0][0]).toEqual(
            mergeAiDiagram(cur, prop)
        );
    });

    it('sanitizes the ddl for mssql before sending', async () => {
        state.current = diagram(
            [table('users', [field('id')], { id: 'u' })],
            [],
            { databaseType: DatabaseType.SQL_SERVER }
        );
        exportBaseSQL.mockReturnValue(
            'CREATE TABLE users (\n  -- ид\n  id int,\n  name nvarchar(10)\n);'
        );
        streamRefine.mockResolvedValueOnce({
            status: 'no_changes',
            generationId: 'g1',
            remaining: 1,
        });
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        const sent = streamRefine.mock.calls[0][0].ddl as string;
        expect(sent).toBe(
            'CREATE TABLE users (\n  id int,\n  name nvarchar(10)\n);'
        );
        expect(streamRefine.mock.calls[0][0].dialect).toBe('mssql');
    });

    it('stale base: apply does not write, replaces proposal, notice, then succeeds once', async () => {
        const { result, rerender } = renderHook(() => useAiRefine());
        await toReview(result);
        const edited = diagram([
            table('users', [field('id'), field('age')], {
                id: 'u',
                x: 10,
                y: 20,
            }),
        ]);
        state.current = edited;
        rerender();
        await act(async () => {
            await result.current.apply();
        });
        expect(updateDiagramData).not.toHaveBeenCalled();
        expect(finalizeGeneration).not.toHaveBeenCalled();
        expect(result.current.notice).toBe('schema_changed');
        expect(result.current.phase).toBe('review');
        expect(result.current.proposal?.generationId).toBe('g1');
        expect(result.current.proposal?.base).toBe(edited);
        // новая правка пользователя теперь видна в диффе как удаляемая
        expect(result.current.proposal?.diff.tables[0].removedFields).toEqual([
            'age',
        ]);
        await act(async () => {
            await result.current.apply();
        });
        expect(updateDiagramData).toHaveBeenCalledTimes(1);
        const written = updateDiagramData.mock.calls[0][0];
        expect(
            written.tables[0].fields.map((f: { name: string }) => f.name)
        ).toEqual(['id', 'email']);
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(result.current.notice).toBeNull();
    });

    it('stale base whose new diff is empty settles once as charged with noChanges', async () => {
        const { result, rerender } = renderHook(() => useAiRefine());
        await toReview(result);
        state.current = diagram([
            table('users', [field('id'), field('email')], { id: 'u' }),
        ]);
        rerender();
        await act(async () => {
            await result.current.apply();
        });
        expect(updateDiagramData).not.toHaveBeenCalled();
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(successCalls()).toHaveLength(1);
        expect(result.current.noChanges).toBe(true);
        expect(result.current.proposal).toBeNull();
        expect(result.current.phase).toBe('idle');
    });

    it('treats removing 3 of 4 tables as an incomplete answer and refunds once', async () => {
        const four = diagram(
            ['a', 'b', 'c', 'd'].map((n) => table(n, [field('id')]))
        );
        state.current = four;
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockResolvedValueOnce(
            diagram([table('a', [field('id')])])
        );
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('incomplete');
        expect(result.current.phase).toBe('idle');
        expect(result.current.proposal).toBeNull();
        expect(finalizeGeneration).toHaveBeenCalledTimes(1);
        expect(finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });
    });

    it('allows removing 1 of 10 tables', async () => {
        const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
        state.current = diagram(names.map((n) => table(n, [field('id')])));
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockResolvedValueOnce(
            diagram(names.slice(1).map((n) => table(n, [field('id')])))
        );
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.phase).toBe('review');
        expect(
            result.current.proposal?.diff.tables.filter(
                (t) => t.status === 'removed'
            )
        ).toHaveLength(1);
    });

    it('records refundDenied when the daily refund budget is spent', async () => {
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockRejectedValueOnce(new Error('sanity'));
        finalizeGeneration.mockResolvedValueOnce({
            refunded: false,
            remaining: 1,
        });
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('parse');
        expect(result.current.refundDenied).toBe(true);
        act(() => result.current.clearError());
        expect(result.current.refundDenied).toBe(false);
    });

    it('keeps refundDenied false when the refund is granted', async () => {
        streamRefine.mockResolvedValueOnce(generated);
        ddlToDiagram.mockRejectedValueOnce(new Error('sanity'));
        finalizeGeneration.mockResolvedValueOnce({
            refunded: true,
            remaining: 2,
        });
        const { result } = renderHook(() => useAiRefine());
        await act(async () => {
            await result.current.run('review');
        });
        expect(result.current.error).toBe('parse');
        expect(result.current.refundDenied).toBe(false);
    });
});
