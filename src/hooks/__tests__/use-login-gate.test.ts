import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import { useLoginGate } from '../use-login-gate';

describe('useLoginGate', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('lets a logged-in user through without a prompt', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        const { result } = renderHook(() => useLoginGate());

        let allowed = false;
        act(() => {
            allowed = result.current.guard();
        });

        expect(allowed).toBe(true);
        expect(result.current.promptOpen).toBe(false);
    });

    it('blocks an anonymous user and opens the prompt', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        const { result } = renderHook(() => useLoginGate());

        let allowed = true;
        act(() => {
            allowed = result.current.guard();
        });

        expect(allowed).toBe(false);
        expect(result.current.promptOpen).toBe(true);
    });
});
