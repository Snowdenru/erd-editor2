import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
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

    describe('re-scroll after the page settles', () => {
        const mockLoading = () =>
            vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');

        const setup = () => {
            const scrollIntoView = vi.fn();
            Element.prototype.scrollIntoView = scrollIntoView;
            window.history.pushState({}, '', '/tools/erd2/about#databases');
            return scrollIntoView;
        };

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('repeats the scroll once on window load', async () => {
            mockLoading();
            const scrollIntoView = setup();
            renderAbout('/tools/erd2/about#databases');
            await waitFor(() =>
                expect(scrollIntoView).toHaveBeenCalledTimes(1)
            );

            window.dispatchEvent(new Event('load'));
            expect(scrollIntoView).toHaveBeenCalledTimes(2);

            window.dispatchEvent(new Event('load'));
            expect(scrollIntoView).toHaveBeenCalledTimes(2);
        });

        it.each([['wheel'], ['touchmove'], ['keydown']])(
            'does not repeat the scroll after a manual %s',
            async (type) => {
                mockLoading();
                const scrollIntoView = setup();
                renderAbout('/tools/erd2/about#databases');
                await waitFor(() =>
                    expect(scrollIntoView).toHaveBeenCalledTimes(1)
                );

                fireEvent(window, new Event(type));
                window.dispatchEvent(new Event('load'));
                expect(scrollIntoView).toHaveBeenCalledTimes(1);
            }
        );

        it('removes listeners on unmount', async () => {
            mockLoading();
            const scrollIntoView = setup();
            const { unmount } = renderAbout('/tools/erd2/about#databases');
            await waitFor(() =>
                expect(scrollIntoView).toHaveBeenCalledTimes(1)
            );

            unmount();
            window.dispatchEvent(new Event('load'));
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
        });

        it('does not register a load handler when the page is already loaded', async () => {
            const scrollIntoView = setup();
            renderAbout('/tools/erd2/about#databases');
            await waitFor(() =>
                expect(scrollIntoView).toHaveBeenCalledTimes(1)
            );

            window.dispatchEvent(new Event('load'));
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
        });
    });
});
