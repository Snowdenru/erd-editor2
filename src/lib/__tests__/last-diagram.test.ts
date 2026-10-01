import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    LAST_DIAGRAM_KEY,
    clearLastDiagramIfMatches,
    getLastDiagramId,
    keepLastDiagramMarker,
    setLastDiagramId,
} from '../last-diagram';

describe('last-diagram', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it('пишет и читает id', () => {
        setLastDiagramId('abc123');
        expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBe('abc123');
        expect(getLastDiagramId()).toBe('abc123');
    });

    it('пустой id удаляет ключ', () => {
        setLastDiagramId('abc123');
        setLastDiagramId('');
        expect(localStorage.getItem(LAST_DIAGRAM_KEY)).toBeNull();
        expect(getLastDiagramId()).toBe('');
    });

    it('clearLastDiagramIfMatches чистит только совпадающий id', () => {
        setLastDiagramId('abc123');
        clearLastDiagramIfMatches('other');
        expect(getLastDiagramId()).toBe('abc123');
        clearLastDiagramIfMatches('abc123');
        expect(getLastDiagramId()).toBe('');
    });

    it('не падает, если localStorage недоступен', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(getLastDiagramId()).toBe('');
        expect(() => setLastDiagramId('abc')).not.toThrow();
    });

    describe('keepLastDiagramMarker', () => {
        it('возвращает маркер, если операция его стёрла (удаление+добавление той же схемы)', async () => {
            setLastDiagramId('d1');
            await keepLastDiagramMarker('d1', async () => {
                clearLastDiagramIfMatches('d1');
            });
            expect(getLastDiagramId()).toBe('d1');
        });

        it('не ставит маркер, если он указывал на другую схему', async () => {
            setLastDiagramId('other');
            await keepLastDiagramMarker('d1', async () => {
                clearLastDiagramIfMatches('d1');
            });
            expect(getLastDiagramId()).toBe('other');
        });

        it('не создаёт маркер, если его не было', async () => {
            await keepLastDiagramMarker('d1', async () => undefined);
            expect(getLastDiagramId()).toBe('');
        });

        it('при ошибке операции маркер не трогает', async () => {
            setLastDiagramId('d1');
            await expect(
                keepLastDiagramMarker('d1', async () => {
                    clearLastDiagramIfMatches('d1');
                    throw new Error('boom');
                })
            ).rejects.toThrow('boom');
            expect(getLastDiagramId()).toBe('');
        });
    });
});
