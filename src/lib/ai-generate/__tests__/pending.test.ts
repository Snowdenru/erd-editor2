import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearPending, consumePending, savePending } from '../pending';

const jwt = (userId: number) =>
    `h.${btoa(JSON.stringify({ user_id: userId }))}.s`;

beforeEach(() => {
    localStorage.clear();
    Cookies.remove('access_token');
});

describe('pending prompt', () => {
    it('is returned once for the same page', () => {
        savePending({ prompt: 'Школа', dialect: 'mysql' });
        expect(consumePending()).toMatchObject({ prompt: 'Школа' });
        expect(consumePending()).toBeNull();
    });

    it('is kept while the user is still logged out of another page', () => {
        savePending({ prompt: 'Школа', dialect: 'mysql' });
        expect(consumePending(Date.now() + 1000)).not.toBeNull();
    });

    it('is dropped for a different user', () => {
        Cookies.set('access_token', jwt(1));
        savePending({ prompt: 'Школа', dialect: 'mysql' });
        Cookies.set('access_token', jwt(2));
        expect(consumePending()).toBeNull();
        Cookies.set('access_token', jwt(1));
        expect(consumePending()).toBeNull();
    });

    it('is replayed for the same user', () => {
        Cookies.set('access_token', jwt(1));
        savePending({ prompt: 'Школа', dialect: 'mysql' });
        expect(consumePending()).not.toBeNull();
    });

    it('clearPending removes it', () => {
        savePending({ prompt: 'Школа', dialect: 'mysql' });
        clearPending();
        expect(consumePending()).toBeNull();
    });
});

describe('pending prompt with explicit path', () => {
    it('is stored for the given route, not the current page', () => {
        savePending({ prompt: 'Школа', dialect: 'mysql', path: '/other/new' });
        expect(consumePending()).toBeNull();
        window.history.pushState({}, '', '/other/new');
        expect(consumePending()).toMatchObject({ path: '/other/new' });
        window.history.pushState({}, '', '/');
    });
});
