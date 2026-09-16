import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddDiagram = vi.fn();
const mockDeleteDiagram = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        addDiagram: mockAddDiagram,
        deleteDiagram: mockDeleteDiagram,
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

        expect(mockDeleteDiagram).toHaveBeenCalledWith(example.diagram.id);
        expect(mockAddDiagram).toHaveBeenCalledWith(
            expect.objectContaining({
                diagram: expect.objectContaining({ id: example.diagram.id }),
            })
        );
        expect(mockNavigate).toHaveBeenCalledWith(
            `/diagrams/${example.diagram.id}`
        );
    });

    it('clears loadingExampleId even when deleteDiagram rejects', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const example = result.current.examples[0];

        mockDeleteDiagram.mockRejectedValueOnce(new Error('quota exceeded'));

        await act(async () => {
            await expect(
                result.current.utilizeExample({ example })
            ).rejects.toThrow('quota exceeded');
        });

        expect(result.current.loadingExampleId).toBeUndefined();
        expect(mockAddDiagram).not.toHaveBeenCalled();

        // A retry after the failure should not be blocked by a stuck
        // loadingExampleId.
        mockDeleteDiagram.mockResolvedValueOnce(undefined);
        await act(async () => {
            await result.current.utilizeExample({ example });
        });

        expect(mockDeleteDiagram).toHaveBeenCalledTimes(2);
        expect(mockAddDiagram).toHaveBeenCalledTimes(1);
    });

    it('ignores a second call while the first is still loading', async () => {
        const { result } = renderHook(() => useExampleDiagrams());
        const example = result.current.examples[0];

        mockDeleteDiagram.mockImplementation(() => new Promise(() => {}));

        act(() => {
            void result.current.utilizeExample({ example });
        });

        await act(async () => {
            await result.current.utilizeExample({ example });
        });

        expect(mockDeleteDiagram).toHaveBeenCalledTimes(1);
    });
});
