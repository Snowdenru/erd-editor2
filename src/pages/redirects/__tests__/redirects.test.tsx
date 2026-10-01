import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    createMemoryRouter,
    RouterProvider,
    useLocation,
} from 'react-router-dom';
import {
    RedirectToDiagrams,
    LegacyDiagramRedirect,
    LegacyTemplateCloneRedirect,
} from '../redirects';

const Where = () => {
    const l = useLocation();
    return <div data-testid="where">{l.pathname + l.search + l.hash}</div>;
};

const renderAt = (url: string) => {
    const router = createMemoryRouter(
        [
            { path: '/', element: <RedirectToDiagrams /> },
            { path: '/diagrams', element: <Where /> },
            {
                path: '/diagrams/:diagramId',
                element: <LegacyDiagramRedirect />,
            },
            { path: '/d/:diagramId', element: <Where /> },
            {
                path: '/templates/clone/:templateSlug',
                element: <LegacyTemplateCloneRedirect />,
            },
            { path: '/templates/:templateSlug/use', element: <Where /> },
        ],
        { initialEntries: [url] }
    );
    render(<RouterProvider router={router} />);
    return router;
};

describe('редиректы старых адресов', () => {
    it('/ → /diagrams с сохранением query и hash', () => {
        renderAt('/?open=import&tab=ddl#x');
        expect(screen.getByTestId('where').textContent).toBe(
            '/diagrams?open=import&tab=ddl#x'
        );
    });

    it('/diagrams/:id → /d/:id', () => {
        renderAt('/diagrams/abc');
        expect(screen.getByTestId('where').textContent).toBe('/d/abc');
    });

    it('/templates/clone/:slug → /templates/:slug/use', () => {
        renderAt('/templates/clone/shop');
        expect(screen.getByTestId('where').textContent).toBe(
            '/templates/shop/use'
        );
    });

    it('редирект заменяет запись истории (кнопка «назад» не зацикливается)', () => {
        const router = renderAt('/diagrams/abc');
        expect(router.state.historyAction).toBe('REPLACE');
    });
});
