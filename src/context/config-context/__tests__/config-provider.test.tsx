import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from '../config-provider';
import { useConfig } from '@/hooks/use-config';
import { LAST_DIAGRAM_KEY } from '@/lib/last-diagram';

const storage = vi.hoisted(() => ({
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getDiagram: vi.fn(),
}));
vi.mock('@/hooks/use-storage', () => ({ useStorage: () => storage }));

let update: ReturnType<typeof useConfig>['updateConfig'];
const Probe: React.FC = () => {
    update = useConfig().updateConfig;
    return null;
};

describe('ConfigProvider и маркер последней схемы', () => {
    beforeEach(() => {
        localStorage.clear();
        storage.getConfig.mockResolvedValue({ defaultDiagramId: 'abc' });
        storage.updateConfig.mockResolvedValue(undefined);
        storage.getDiagram.mockResolvedValue({ id: 'abc' });
    });

    it('при загрузке конфига записывает маркер', async () => {
        render(
            <ConfigProvider>
                <Probe />
            </ConfigProvider>
        );
        await waitFor(() =>
            expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBe('abc')
        );
    });

    it('при смене defaultDiagramId обновляет маркер', async () => {
        render(
            <ConfigProvider>
                <Probe />
            </ConfigProvider>
        );
        await waitFor(() =>
            expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBe('abc')
        );
        // updateConfig резолвится только после прогона state-updater'а React,
        // поэтому внутри act его нельзя await-ить (дедлок) — ждём результат отдельно.
        let done!: Promise<void>;
        act(() => {
            done = update({ config: { defaultDiagramId: 'xyz' } });
        });
        await done;
        expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBe('xyz');
    });

    it('не записывает маркер, если схема из конфига удалена', async () => {
        storage.getDiagram.mockResolvedValue(undefined);
        localStorage.setItem(LAST_DIAGRAM_KEY, 'abc');
        render(
            <ConfigProvider>
                <Probe />
            </ConfigProvider>
        );
        await waitFor(() =>
            expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBeNull()
        );
    });

    it('чистит устаревший маркер, если IndexedDB очищена, а localStorage нет', async () => {
        storage.getConfig.mockResolvedValue(undefined);
        storage.getDiagram.mockResolvedValue(undefined);
        localStorage.setItem(LAST_DIAGRAM_KEY, 'ghost');
        render(
            <ConfigProvider>
                <Probe />
            </ConfigProvider>
        );
        await waitFor(() =>
            expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBeNull()
        );
        expect(storage.getDiagram).toHaveBeenCalledWith('ghost');
    });

    it('не трогает маркер, если схема существует, а defaultDiagramId пуст', async () => {
        storage.getConfig.mockResolvedValue({ defaultDiagramId: '' });
        storage.getDiagram.mockResolvedValue({ id: 'keep' });
        localStorage.setItem(LAST_DIAGRAM_KEY, 'keep');
        render(
            <ConfigProvider>
                <Probe />
            </ConfigProvider>
        );
        await waitFor(() => expect(storage.getDiagram).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
        });
        expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBe('keep');
    });
});
