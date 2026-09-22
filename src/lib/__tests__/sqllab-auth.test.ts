import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';
import { getAccessToken, authFetch, logout } from '../sqllab-auth';

describe('sqllab-auth', () => {
    beforeEach(() => {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        vi.restoreAllMocks();
    });

    it('returns null when no access_token cookie is set', () => {
        expect(getAccessToken()).toBeNull();
    });

    it('returns the raw cookie value when set', () => {
        Cookies.set('access_token', 'abc.def.ghi');
        expect(getAccessToken()).toBe('abc.def.ghi');
    });

    it('authFetch attaches Authorization header from the cookie', async () => {
        Cookies.set('access_token', 'my-token');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        await authFetch('/api/erd2/diagrams/');

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/erd2/diagrams/',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer my-token',
                }),
            })
        );
    });

    it('authFetch refreshes the token once on 401 and retries', async () => {
        Cookies.set('access_token', 'expired-token');
        Cookies.set('refresh_token', 'my-refresh-token');

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        access: 'new-token',
                        refresh: 'new-refresh',
                    }),
                    {
                        status: 200,
                    }
                )
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const res = await authFetch('/api/erd2/diagrams/');

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(Cookies.get('access_token')).toBe('new-token');
    });

    it('logout posts the refresh token and clears both cookies', async () => {
        Cookies.set('access_token', 'my-access');
        Cookies.set('refresh_token', 'my-refresh');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        await logout();

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/auth/logout/',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ refresh: 'my-refresh' }),
            })
        );
        expect(Cookies.get('access_token')).toBeUndefined();
        expect(Cookies.get('refresh_token')).toBeUndefined();
    });

    it('logout clears cookies even when the request fails', async () => {
        Cookies.set('access_token', 'my-access');
        Cookies.set('refresh_token', 'my-refresh');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

        await logout();

        expect(Cookies.get('access_token')).toBeUndefined();
        expect(Cookies.get('refresh_token')).toBeUndefined();
    });

    it('logout makes no network call when there is no refresh token', async () => {
        Cookies.set('access_token', 'my-access');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await logout();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(Cookies.get('access_token')).toBeUndefined();
    });
});
