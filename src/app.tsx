import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { TooltipProvider } from './components/tooltip/tooltip';
import { HelmetData } from './helmet/helmet-data';
import { HelmetProvider } from 'react-helmet-async';
import { CookieBanner } from './components/cookie-banner/cookie-banner';

export const App = () => {
    return (
        <HelmetProvider>
            <HelmetData />
            <TooltipProvider>
                <RouterProvider router={router} />
                <CookieBanner />
            </TooltipProvider>
        </HelmetProvider>
    );
};
