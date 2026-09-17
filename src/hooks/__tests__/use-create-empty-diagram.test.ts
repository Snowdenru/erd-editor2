import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddDiagram = vi.fn();
const mockListDiagrams = vi.fn();
const mockUpdateConfig = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/use-storage', () => ({
    useStorage: () => ({
        addDiagram: mockAddDiagram,
        listDiagrams: mockListDiagrams,
    }),
}));

vi.mock('@/hooks/use-config', () => ({
    useConfig: () => ({
        updateConfig: mockUpdateConfig,
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

import { useCreateEmptyDiagram } from '../use-create-empty-diagram';

describe('useCreateEmptyDiagram', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListDiagrams.mockResolvedValue([]);
    });

    it('creates a PostgreSQL diagram, saves it, sets it as default and navigates to it', async () => {
        const { result } = renderHook(() => useCreateEmptyDiagram());

        await act(async () => {
            await result.current.createEmptyDiagram();
        });

        expect(mockAddDiagram).toHaveBeenCalledWith(
            expect.objectContaining({
                diagram: expect.objectContaining({
                    databaseType: 'postgresql',
                    name: 'Diagram 1',
                }),
            })
        );

        const savedDiagram = mockAddDiagram.mock.calls[0][0].diagram;
        expect(mockUpdateConfig).toHaveBeenCalledWith({
            config: { defaultDiagramId: savedDiagram.id },
        });
        expect(mockNavigate).toHaveBeenCalledWith(
            `/diagrams/${savedDiagram.id}`
        );
    });

    it('numbers the diagram after the count of existing diagrams', async () => {
        mockListDiagrams.mockResolvedValue([{}, {}]);
        const { result } = renderHook(() => useCreateEmptyDiagram());

        await act(async () => {
            await result.current.createEmptyDiagram();
        });

        expect(mockAddDiagram).toHaveBeenCalledWith(
            expect.objectContaining({
                diagram: expect.objectContaining({ name: 'Diagram 3' }),
            })
        );
    });
});
