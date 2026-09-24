import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId } from '../erd2-session';

describe('getSessionId', () => {
    beforeEach(() => sessionStorage.clear());

    it('returns a backend-compatible id (a-z0-9, <=50)', () => {
        expect(getSessionId()).toMatch(/^[a-z0-9]{8,50}$/);
    });

    it('is stable within a tab', () => {
        expect(getSessionId()).toBe(getSessionId());
    });

    it('is regenerated when storage is empty', () => {
        const first = getSessionId();
        sessionStorage.clear();
        const second = getSessionId();
        expect(second).toMatch(/^[a-z0-9]{8,50}$/);
        expect(second).not.toBe(first);
        expect(sessionStorage.getItem('erd2_session_id')).toBe(second);
        expect(getSessionId()).toBe(second);
    });
});
