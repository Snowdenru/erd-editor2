import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CookieBanner } from '../cookie-banner';

describe('CookieBanner', () => {
    beforeEach(() => {
        localStorage.clear();
        document.head.innerHTML = '';
        delete window.ym;
        delete window.__ERD2_PRERENDER__;
    });

    it('показывается, пока нет ответа, и скрывается после «Принять»', () => {
        render(<CookieBanner />);
        fireEvent.click(screen.getByRole('button', { name: 'Принять' }));
        expect(localStorage.getItem('cookie_consent')).toBe('accepted');
        expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull();
    });

    it('не показывается, если согласие уже дано', () => {
        localStorage.setItem('cookie_consent', 'accepted');
        render(<CookieBanner />);
        expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull();
    });

    it('скрывается, когда согласие дано в другой вкладке', () => {
        render(<CookieBanner />);
        expect(screen.getByRole('button', { name: 'Принять' })).toBeTruthy();
        act(() => {
            localStorage.setItem('cookie_consent', 'accepted');
            window.dispatchEvent(new Event('cookie_consent_updated'));
        });
        expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull();
    });

    it('не показывается при предрендере', () => {
        window.__ERD2_PRERENDER__ = true;
        render(<CookieBanner />);
        expect(screen.queryByRole('button', { name: 'Принять' })).toBeNull();
    });

    it('ссылки ведут на политики основного сайта', () => {
        render(<CookieBanner />);
        const hrefs = screen
            .getAllByRole('link')
            .map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual([
            'https://sqllab.ru/legal/cookies',
            'https://sqllab.ru/legal/privacy',
        ]);
    });
});
