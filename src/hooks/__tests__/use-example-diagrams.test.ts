import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddDiagram = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        addDiagram: mockAddDiagram,
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

import { useExampleDiagrams } from '../use-example-diagrams';

describe('useExampleDiagrams', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exposes the built-in example list', () => {
        const { result } = renderHook(() => useExampleDiagrams());
        expect(result.current.examples.length).toBeGreaterThan(0);
    });

    it('clones the example diagram and navigates to it', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const example = result.current.examples[0];

        await act(async () => {
            await result.current.utilizeExample({ example });
        });

        expect(mockAddDiagram).toHaveBeenCalledTimes(1);
        const added = mockAddDiagram.mock.calls[0][0].diagram;
        // Копия независима от примера: свой id и свои id таблиц
        expect(added.id).not.toBe(example.diagram.id);
        expect(added.name).toBe(example.diagram.name);
        expect(added.tables).toHaveLength(example.diagram.tables?.length ?? 0);
        expect(added.tables[0].id).not.toBe(example.diagram.tables?.[0].id);
        expect(mockNavigate).toHaveBeenCalledWith(`/diagrams/${added.id}`);
    });

    it('creates a separate copy on every click, so examples never overwrite each other', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const [first, second] = result.current.examples;

        await act(async () => {
            await result.current.utilizeExample({ example: first });
        });
        await act(async () => {
            await result.current.utilizeExample({ example: second });
        });

        const ids = mockAddDiagram.mock.calls.map((call) => call[0].diagram.id);
        expect(new Set(ids).size).toBe(2);
    });

    it('clears loadingExampleId even when addDiagram rejects', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const example = result.current.examples[0];

        mockAddDiagram.mockRejectedValueOnce(new Error('quota exceeded'));

        await act(async () => {
            await expect(
                result.current.utilizeExample({ example })
            ).rejects.toThrow('quota exceeded');
        });

        expect(result.current.loadingExampleId).toBeUndefined();

        // A retry after the failure should not be blocked by a stuck
        // loadingExampleId.
        mockAddDiagram.mockResolvedValueOnce(undefined);
        await act(async () => {
            await result.current.utilizeExample({ example });
        });

        expect(mockAddDiagram).toHaveBeenCalledTimes(2);
    });

    it('ignores a second call while the first is still loading', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const example = result.current.examples[0];

        mockAddDiagram.mockImplementation(() => new Promise(() => {}));

        act(() => {
            void result.current.utilizeExample({ example });
        });

        await act(async () => {
            await result.current.utilizeExample({ example });
        });

        expect(mockAddDiagram).toHaveBeenCalledTimes(1);
    });
});
