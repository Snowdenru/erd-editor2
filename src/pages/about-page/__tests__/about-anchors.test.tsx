import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AboutPage } from '../about-page';

vi.mock('@/lib/sqllab-account', () => ({ trackPageView: vi.fn() }));

const renderAbout = (path: string) =>
    render(
        <HelmetProvider>
            <MemoryRouter basename="/tools/erd2" initialEntries={[path]}>
                <AboutPage />
            </MemoryRouter>
        </HelmetProvider>
    );

describe('AboutPage anchor scrolling', () => {
    const original = Element.prototype.scrollIntoView;

    afterEach(() => {
        Element.prototype.scrollIntoView = original;
        window.history.pushState({}, '', '/');
    });

    it('smoothly scrolls to the section from the initial hash', async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        window.history.pushState({}, '', '/tools/erd2/about#databases');

        renderAbout('/tools/erd2/about#databases');

        await waitFor(() =>
            expect(scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'start',
            })
        );
        expect(
            (scrollIntoView.mock.instances[0] as unknown as HTMLElement).id
        ).toBe('databases');
    });

    it('does not scroll when there is no hash', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        window.history.pushState({}, '', '/tools/erd2/about');

        renderAbout('/tools/erd2/about');

        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
