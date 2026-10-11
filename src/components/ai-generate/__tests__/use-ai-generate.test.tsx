import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AiApiError } from '@/lib/ai-generate/types';
import type * as RouterModule from 'react-router-dom';
import type * as ApiModule from '@/lib/ai-generate/api';
import { useAiGenerate } from '../use-ai-generate';

const m = vi.hoisted(() => ({
    navigate: vi.fn(),
    addDiagram: vi.fn(),
    closeCreateDiagramDialog: vi.fn(),
    trackEvent: vi.fn(),
    streamGenerate: vi.fn(),
    finalizeGeneration: vi.fn(),
    listGenerations: vi.fn(),
    getGeneration: vi.fn(),
    deleteGeneration: vi.fn(),
    ddlToDiagram: vi.fn(),
}));

vi.mock('react-router-dom', async (orig) => ({
    ...(await orig<typeof RouterModule>()),
    useNavigate: () => m.navigate,
}));
vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({ addDiagram: m.addDiagram }),
}));
vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({ closeCreateDiagramDialog: m.closeCreateDiagramDialog }),
}));
vi.mock('@/lib/sqllab-account', () => ({ trackEvent: m.trackEvent }));
vi.mock('@/lib/ai-generate/api', async (orig) => ({
    ...(await orig<typeof ApiModule>()),
    streamGenerate: m.streamGenerate,
    finalizeGeneration: m.finalizeGeneration,
    listGenerations: m.listGenerations,
    getGeneration: m.getGeneration,
    deleteGeneration: m.deleteGeneration,
}));
vi.mock('@/lib/ai-generate/import-ddl', () => ({
    ddlToDiagram: m.ddlToDiagram,
}));

const DDL = 'CREATE TABLE a (id int);\nCREATE TABLE b (id int);';
const diagram = { id: 'd1', name: 'Школа', tables: [{}, {}] };

beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset());
    m.addDiagram.mockResolvedValue(undefined);
    m.finalizeGeneration.mockResolvedValue({ refunded: false, remaining: 2 });
    m.streamGenerate.mockImplementation(async ({ onDelta }) => {
        onDelta('CREATE TABLE a (id int);\n');
        onDelta('CREATE TABLE b (id int);');
        return {
            status: 'generated',
            generationId: 'g1',
            ddl: DDL,
            remaining: 2,
        };
    });
    m.ddlToDiagram.mockResolvedValue(diagram);
});

describe('useAiGenerate.generate', () => {
    it('streams, imports, saves, finalizes and opens the diagram', async () => {
        const onDone = vi.fn();
        const { result } = renderHook(() => useAiGenerate({ onDone }));

        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });

        expect(m.ddlToDiagram).toHaveBeenCalledWith({
            ddl: DDL,
            dialect: 'mysql',
            prompt: 'школа',
        });
        expect(m.addDiagram).toHaveBeenCalledWith({ diagram });
        expect(m.finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'success',
            table_count: 2,
            diagram_id: 'd1',
        });
        expect(m.navigate).toHaveBeenCalledWith('/d/d1');
        expect(m.closeCreateDiagramDialog).toHaveBeenCalled();
        expect(onDone).toHaveBeenCalled();
        expect(result.current.phase).toBe('idle');
        expect(result.current.error).toBeNull();
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_start',
            expect.any(String),
            { dialect: 'mysql' }
        );
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_success',
            expect.any(String),
            { dialect: 'mysql', tables: 2 }
        );
    });

    it('tracks table count while streaming', async () => {
        let release: () => void = () => undefined;
        m.streamGenerate.mockImplementation(
            ({ onDelta }) =>
                new Promise((resolve) => {
                    onDelta('CREATE TABLE a (id int);\nCREATE TABLE b');
                    release = () =>
                        resolve({
                            status: 'generated',
                            generationId: 'g1',
                            ddl: DDL,
                            remaining: 2,
                        });
                })
        );
        const { result } = renderHook(() => useAiGenerate());
        let pending: Promise<void> = Promise.resolve();
        act(() => {
            pending = result.current.generate('школа', 'mysql');
        });
        await waitFor(() => expect(result.current.tableCount).toBe(2));
        expect(result.current.phase).toBe('generating');
        await act(async () => {
            release();
            await pending;
        });
    });

    it('reports parse failure, asks the server for a refund and does not save', async () => {
        m.ddlToDiagram.mockRejectedValue(new Error('syntax'));
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(m.finalizeGeneration).toHaveBeenCalledWith('g1', {
            status: 'parse_failed',
        });
        expect(result.current.error).toBe('parse');
        expect(m.addDiagram).not.toHaveBeenCalled();
        expect(m.navigate).not.toHaveBeenCalled();
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_fail',
            expect.any(String),
            { reason: 'parse' }
        );
    });

    it('maps off-topic and provider outcomes to errors without saving', async () => {
        m.streamGenerate.mockResolvedValueOnce({
            status: 'rejected_off_topic',
            generationId: 'g2',
            remaining: 3,
        });
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.generate('погода', 'mysql');
        });
        expect(result.current.error).toBe('off_topic');

        m.streamGenerate.mockResolvedValueOnce({
            status: 'provider_error',
            generationId: 'g3',
            remaining: 3,
        });
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(result.current.error).toBe('provider');
        expect(m.addDiagram).not.toHaveBeenCalled();
    });

    it('shows the free-tier wall and tracks it', async () => {
        m.streamGenerate.mockRejectedValue(
            new AiApiError(403, 'generation_limit', 3)
        );
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(result.current.error).toBe('limit_free');
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_limit_wall',
            expect.any(String),
            { reason: 'limit_free' }
        );
    });

    it('maps cooldown and daily ceiling', async () => {
        m.streamGenerate.mockRejectedValueOnce(new AiApiError(429, 'cooldown'));
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(result.current.error).toBe('cooldown');

        m.streamGenerate.mockRejectedValueOnce(
            new AiApiError(429, 'daily_ceiling', 30)
        );
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(result.current.error).toBe('limit_daily');
    });

    it('cancel aborts the request silently', async () => {
        m.streamGenerate.mockImplementation(
            ({ signal }) =>
                new Promise((_, reject) => {
                    signal.addEventListener('abort', () =>
                        reject(new DOMException('aborted', 'AbortError'))
                    );
                })
        );
        const { result } = renderHook(() => useAiGenerate());
        let pending: Promise<void> = Promise.resolve();
        act(() => {
            pending = result.current.generate('школа', 'mysql');
        });
        await waitFor(() => expect(result.current.phase).toBe('generating'));
        await act(async () => {
            result.current.cancel();
            await pending;
        });
        expect(result.current.phase).toBe('idle');
        expect(result.current.error).toBeNull();
        expect(m.addDiagram).not.toHaveBeenCalled();
    });

    it('ignores a second generate while one is running', async () => {
        let release: () => void = () => undefined;
        m.streamGenerate.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve({
                            status: 'rejected_off_topic',
                            generationId: 'g',
                            remaining: 3,
                        });
                })
        );
        const { result } = renderHook(() => useAiGenerate());
        let first: Promise<void> = Promise.resolve();
        act(() => {
            first = result.current.generate('школа', 'mysql');
        });
        await act(async () => {
            await result.current.generate('школа', 'mysql');
        });
        expect(m.streamGenerate).toHaveBeenCalledTimes(1);
        await act(async () => {
            release();
            await first;
        });
    });
});

describe('useAiGenerate history', () => {
    it('restore opens a saved variant without calling the generator', async () => {
        m.getGeneration.mockResolvedValue({
            id: 'g1',
            prompt: 'школа',
            dialect: 'mysql',
            table_count: 2,
            ddl: DDL,
            created_at: 'x',
        });
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.restore('g1');
        });
        expect(m.streamGenerate).not.toHaveBeenCalled();
        expect(m.ddlToDiagram).toHaveBeenCalledWith({
            ddl: DDL,
            dialect: 'mysql',
            prompt: 'школа',
        });
        expect(m.addDiagram).toHaveBeenCalledWith({ diagram });
        expect(m.navigate).toHaveBeenCalledWith('/d/d1');
        expect(m.finalizeGeneration).not.toHaveBeenCalled();
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_restore',
            expect.any(String),
            {}
        );
    });

    it('restore reports a parse error when the saved DDL no longer imports', async () => {
        m.getGeneration.mockResolvedValue({
            id: 'g1',
            prompt: 'p',
            dialect: 'mysql',
            table_count: 2,
            ddl: 'x',
            created_at: 'x',
        });
        m.ddlToDiagram.mockRejectedValue(new Error('syntax'));
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.restore('g1');
        });
        expect(result.current.error).toBe('parse');
        expect(m.navigate).not.toHaveBeenCalled();
    });

    it('reload fills history and usage; remove drops the item', async () => {
        const usage = {
            tier: 'free',
            kind: 'lifetime',
            limit: 3,
            used: 1,
            remaining: 2,
        };
        const item = {
            id: 'g1',
            prompt: 'школа',
            dialect: 'mysql',
            table_count: 2,
            diagram_id: null,
            tables: ['a'],
            created_at: 'x',
        };
        m.listGenerations.mockResolvedValue({ usage, results: [item] });
        m.deleteGeneration.mockResolvedValue(undefined);
        const { result } = renderHook(() => useAiGenerate());
        await act(async () => {
            await result.current.reload();
        });
        expect(result.current.history).toEqual([item]);
        expect(result.current.usage).toEqual(usage);
        expect(result.current.historyLoaded).toBe(true);
        await act(async () => {
            await result.current.remove('g1');
        });
        expect(m.deleteGeneration).toHaveBeenCalledWith('g1');
        expect(result.current.history).toEqual([]);
    });
});
