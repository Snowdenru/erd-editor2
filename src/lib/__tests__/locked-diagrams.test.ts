import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getLockedCards,
    setLockedCards,
    subscribeLockedCards,
} from '../locked-diagrams';

const card = (id: string) => ({
    id,
    title: id,
    tables: 12,
    dbType: null,
    savedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('locked-diagrams store', () => {
    beforeEach(() => setLockedCards([]));

    it('returns what was set, with a stable reference between sets', () => {
        const cards = [card('a')];
        setLockedCards(cards);
        expect(getLockedCards()).toBe(cards);
        expect(getLockedCards()).toBe(getLockedCards());
    });

    it('notifies subscribers and stops after unsubscribe', () => {
        const handler = vi.fn();
        const off = subscribeLockedCards(handler);
        setLockedCards([card('a')]);
        expect(handler).toHaveBeenCalledTimes(1);
        off();
        setLockedCards([card('b')]);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
