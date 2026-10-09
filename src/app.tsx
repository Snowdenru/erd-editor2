import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { TooltipProvider } from './components/tooltip/tooltip';
import { HelmetData } from './helmet/helmet-data';
import { HelmetProvider } from 'react-helmet-async';
import { CookieBanner } from './components/cookie-banner/cookie-banner';
import { isEmbedPath } from './lib/embed-route';

export const App = () => {
    // Router создан с basename, а баннер стоит вне него — смотрим на реальный путь страницы
    const showCookieBanner = !isEmbedPath(window.location.pathname);
    return (
        <HelmetProvider>
            <HelmetData />
            <TooltipProvider>
                <RouterProvider router={router} />
                {showCookieBanner ? <CookieBanner /> : null}
            </TooltipProvider>
        </HelmetProvider>
    );
};
