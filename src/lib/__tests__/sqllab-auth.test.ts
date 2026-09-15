import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';
import { getAccessToken, authFetch } from '../sqllab-auth';

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
});
