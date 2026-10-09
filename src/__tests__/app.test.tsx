import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('../router', () => ({ router: {} }));
vi.mock('react-router-dom', () => ({ RouterProvider: () => <div /> }));
vi.mock('../helmet/helmet-data', () => ({ HelmetData: () => null }));
vi.mock('../components/tooltip/tooltip', () => ({
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock('../components/cookie-banner/cookie-banner', () => ({
    CookieBanner: () => <div data-testid="cookie-banner" />,
}));

import { App } from '../app';

describe('App: cookie-баннер', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('показывается на обычных страницах', () => {
        window.history.pushState({}, '', '/tools/erd/v/abc');
        const view = render(<App />);
        expect(view.queryByTestId('cookie-banner')).not.toBeNull();
    });

    it('не показывается в embed', () => {
        window.history.pushState({}, '', '/tools/erd/v/abc/embed');
        const view = render(<App />);
        expect(view.queryByTestId('cookie-banner')).toBeNull();
    });
});
