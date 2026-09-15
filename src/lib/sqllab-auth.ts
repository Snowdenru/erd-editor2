import Cookies from 'js-cookie';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export function getAccessToken(): string | null {
    return Cookies.get(ACCESS_KEY) ?? null;
}

function getRefreshToken(): string | null {
    return Cookies.get(REFRESH_KEY) ?? null;
}

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
    return Object.fromEntries(new Headers(input).entries());
}

async function refreshAccessToken(): Promise<string | null> {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    const res = await fetch('/api/auth/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;

    const data: { access: string; refresh: string } = await res.json();
    Cookies.set(ACCESS_KEY, data.access, { expires: 1, sameSite: 'lax' });
    Cookies.set(REFRESH_KEY, data.refresh, { expires: 30, sameSite: 'lax' });
    return data.access;
}

export async function authFetch(
    url: string,
    init: RequestInit = {}
): Promise<Response> {
    const token = getAccessToken();
    const headers: Record<string, string> = normalizeHeaders(init.headers);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...init, headers });
    if (res.status !== 401) return res;

    const newToken = await refreshAccessToken();
    if (!newToken) return res;

    const retryHeaders: Record<string, string> = normalizeHeaders(init.headers);
    retryHeaders['Authorization'] = `Bearer ${newToken}`;
    return fetch(url, { ...init, headers: retryHeaders });
}
