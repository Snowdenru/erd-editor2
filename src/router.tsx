import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter } from 'react-router-dom';
import type { TemplatePageLoaderData } from './pages/template-page/template-page';
import type { TemplatesPageLoaderData } from './pages/templates-page/templates-page';
import { getTemplatesAndAllTags } from './templates-data/template-utils';
import { APP_BASE } from './lib/app-config';
import { RouteError } from './components/route-error/route-error';
import {
    LegacyDiagramRedirect,
    LegacyTemplateCloneRedirect,
} from './pages/redirects/redirects';

const editorRoute = (path: string): RouteObject => ({
    path,
    async lazy() {
        const { EditorPage } = await import('./pages/editor-page/editor-page');

        return {
            element: <EditorPage />,
        };
    },
});

const routes: RouteObject[] = [
    {
        path: '',
        async lazy() {
            const { AboutPage } = await import('./pages/about-page/about-page');
            return {
                element: <AboutPage />,
            };
        },
    },
    editorRoute('diagrams'),
    editorRoute('new'),
    editorRoute('d/:diagramId'),
    { path: 'diagrams/:diagramId', element: <LegacyDiagramRedirect /> },
    {
        path: 'examples',
        async lazy() {
            const { ExamplesPage } =
                await import('./pages/examples-page/examples-page');
            return {
                element: <ExamplesPage />,
            };
        },
    },
    {
        path: 'about',
        async lazy() {
            const { AboutPage } = await import('./pages/about-page/about-page');
            return {
                element: <AboutPage />,
            };
        },
    },
    {
        path: 'pricing',
        async lazy() {
            const { PricingPage } =
                await import('./pages/pricing-page/pricing-page');
            return {
                element: <PricingPage />,
            };
        },
    },
    {
        id: 'templates',
        path: 'templates',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },

        loader: async (): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags();

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_featured',
        path: 'templates/featured',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },
        loader: async (): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags({
                featured: true,
            });

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_tags',
        path: 'templates/tags/:tag',
        async lazy() {
            const { TemplatesPage } =
                await import('./pages/templates-page/templates-page');
            return {
                element: <TemplatesPage />,
            };
        },
        loader: async ({ params }): Promise<TemplatesPageLoaderData> => {
            const { tags, templates } = await getTemplatesAndAllTags({
                tag: params.tag?.replace(/-/g, ' '),
            });

            return {
                allTags: tags,
                templates,
            };
        },
    },
    {
        id: 'templates_templateSlug',
        path: 'templates/:templateSlug',
        async lazy() {
            const { TemplatePage } =
                await import('./pages/template-page/template-page');
            return {
                element: <TemplatePage />,
            };
        },
        loader: async ({ params }): Promise<TemplatePageLoaderData> => {
            const { templates } =
                await import('./templates-data/templates-data');
            return {
                template: templates.find(
                    (template) => template.slug === params.templateSlug
                ),
            };
        },
    },
    {
        id: 'templates_use',
        path: 'templates/:templateSlug/use',
        async lazy() {
            const { CloneTemplatePage } =
                await import('./pages/clone-template-page/clone-template-page');
            return {
                element: <CloneTemplatePage />,
            };
        },
        loader: async ({ params }) => {
            const { templates } =
                await import('./templates-data/templates-data');
            return {
                template: templates.find(
                    (template) => template.slug === params.templateSlug
                ),
            };
        },
    },
    {
        path: 'templates/clone/:templateSlug',
        element: <LegacyTemplateCloneRedirect />,
    },
    {
        path: '*',
        async lazy() {
            const { NotFoundPage } =
                await import('./pages/not-found-page/not-found-page');
            return {
                element: <NotFoundPage />,
            };
        },
    },
];

export const router = createBrowserRouter(
    routes.map((route) => ({ ...route, errorElement: <RouteError /> })),
    { basename: APP_BASE }
);
