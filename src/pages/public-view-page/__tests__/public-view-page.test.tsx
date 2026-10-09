import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('@/lib/public-share', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, fetchPublicDiagram: vi.fn() };
});
// Холст ChartDB тяжёлый и тут не нужен — проверяем только оболочку страницы.
vi.mock('@/pages/editor-page/canvas/canvas', () => ({
    Canvas: () => <div data-testid="canvas" />,
}));
vi.mock('@/lib/sqllab-account', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, trackEvent: vi.fn() };
});

import { fetchPublicDiagram } from '@/lib/public-share';
import { trackEvent } from '@/lib/sqllab-account';
import { PublicViewPage } from '../public-view-page';

const diagram = {
    id: 'a',
    title: 'Магазин',
    content: { databaseType: 'postgresql', tables: [], relationships: [] },
    database_type: 'postgresql',
    public_theme: 'dark',
    updated_at: '2026-01-01T00:00:00Z',
    grace_until: null,
};

const renderAt = (url: string, embed = false) =>
    render(
        <HelmetProvider>
            <MemoryRouter initialEntries={[url]}>
                <Routes>
                    <Route
                        path="/v/:id/*"
                        element={<PublicViewPage embed={embed} />}
                    />
                </Routes>
            </MemoryRouter>
        </HelmetProvider>
    );

describe('PublicViewPage', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('показывает название и шлёт событие просмотра', async () => {
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: true,
            diagram,
        } as never);
        renderAt('/v/a');
        expect(await screen.findByText('Магазин')).toBeTruthy();
        await waitFor(() =>
            expect(trackEvent).toHaveBeenCalledWith(
                'erd2_public_view',
                expect.any(String),
                { embed: false }
            )
        );
    });

    it('в embed нет шапки с названием, есть подпись', async () => {
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: true,
            diagram,
        } as never);
        renderAt('/v/a/embed', true);
        expect(await screen.findByTestId('canvas')).toBeTruthy();
        expect(screen.queryByText('Магазин')).toBeNull();
        expect(screen.getByText(/ERD · sqllab\.ru/)).toBeTruthy();
    });

    it('closed и not_found показывают разные сообщения', async () => {
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: false,
            code: 'closed',
        });
        const first = renderAt('/v/a');
        expect(await screen.findByText(/Владелец закрыл доступ/)).toBeTruthy();
        first.unmount();
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: false,
            code: 'not_found',
        });
        renderAt('/v/a');
        expect(await screen.findByText(/Схема не найдена/)).toBeTruthy();
    });

    it('плашка отсрочки при grace_until', async () => {
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: true,
            diagram: { ...diagram, grace_until: '2026-12-31T00:00:00Z' },
        } as never);
        renderAt('/v/a');
        expect(await screen.findByText(/Доступ скоро закроется/)).toBeTruthy();
    });

    it('класс dark на странице применяется и восстанавливается при уходе', async () => {
        document.documentElement.classList.remove('dark');
        vi.mocked(fetchPublicDiagram).mockResolvedValue({
            ok: true,
            diagram,
        } as never);
        const view = renderAt('/v/a');
        await screen.findByText('Магазин');
        await waitFor(() =>
            expect(document.documentElement.classList.contains('dark')).toBe(
                true
            )
        );
        view.unmount();
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});
