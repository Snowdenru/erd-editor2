// src/components/export-dialog/__tests__/export-dialog.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { DatabaseType } from '@/lib/domain/database-type';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import * as account from '@/lib/sqllab-account';
import * as download from '@/lib/export/download';
import * as reviewEvents from '@/lib/review-events';
import { shopDiagram } from '@/lib/export/__tests__/fixtures';
import { ExportDialog } from '../export-dialog';

let mockDiagram = shopDiagram();
let mockFilter: DiagramFilter = {};
const mockExportImage = vi.fn().mockResolvedValue(undefined);
const mockPreviewImage = vi
    .fn()
    .mockResolvedValue('data:image/png;base64,PREVIEW');

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ currentDiagram: mockDiagram }),
}));
vi.mock('@/context/diagram-filter-context/use-diagram-filter', () => ({
    useDiagramFilter: () => ({ filter: mockFilter }),
}));
vi.mock('@/hooks/use-export-image', () => ({
    useExportImage: () => ({
        exportImage: mockExportImage,
        previewImage: mockPreviewImage,
    }),
}));
vi.mock('@/hooks/use-theme', () => ({
    useTheme: () => ({ effectiveTheme: 'light' }),
}));
vi.mock('@/components/code-snippet/code-snippet', () => ({
    CodeSnippet: ({ code }: { code: string }) => (
        <pre data-testid="code">{code}</pre>
    ),
}));

const renderDialog = (initialTab: 'image' | 'sql' | 'formats' = 'image') =>
    render(
        <ExportDialog open onOpenChange={vi.fn()} initialTab={initialTab} />
    );

// «Скачать» заблокирована, пока считается превью, поэтому ждём разблокировки
const clickDownload = async () => {
    const button = screen.getByRole('button', { name: 'Скачать' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
};

describe('ExportDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockDiagram = shopDiagram();
        mockFilter = {};
        mockExportImage.mockReset().mockResolvedValue(undefined);
        mockPreviewImage
            .mockReset()
            .mockResolvedValue('data:image/png;base64,PREVIEW');
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        vi.spyOn(reviewEvents, 'emitReviewSignal').mockImplementation(
            () => undefined
        );
        vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
        vi.spyOn(download, 'copyText').mockResolvedValue(true);
    });

    it('opens on the requested tab', () => {
        renderDialog('sql');
        expect(
            screen.getByRole('tab', { name: 'SQL', selected: true })
        ).toBeInTheDocument();
        expect(screen.getByTestId('code').textContent).toContain(
            'CREATE TABLE'
        );
    });

    describe('image tab', () => {
        it('exports PNG with the default options', async () => {
            renderDialog('image');
            await clickDownload();
            await waitFor(() =>
                expect(mockExportImage).toHaveBeenCalledWith('png', {
                    scale: 2,
                    transparent: false,
                    includePatternBG: false,
                })
            );
            expect(account.trackEvent).toHaveBeenCalledWith(
                'erd2_export',
                expect.any(String),
                {
                    format: 'png',
                    db_type: 'postgresql',
                    action: 'download',
                }
            );
            expect(reviewEvents.emitReviewSignal).toHaveBeenCalledWith('nudge');
        });

        it('applies the chosen format, scale and background options', async () => {
            renderDialog('image');
            fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
            await clickDownload();
            await waitFor(() =>
                expect(mockExportImage).toHaveBeenCalledWith('svg', {
                    scale: 1,
                    transparent: false,
                    includePatternBG: false,
                })
            );

            fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
            fireEvent.click(screen.getByRole('button', { name: '3×' }));
            fireEvent.click(screen.getByLabelText('Прозрачный фон'));
            fireEvent.click(screen.getByLabelText('Сетка на фоне'));
            await clickDownload();
            await waitFor(() =>
                expect(mockExportImage).toHaveBeenLastCalledWith('png', {
                    scale: 3,
                    transparent: true,
                    includePatternBG: true,
                })
            );
        });

        it('builds the preview once and does not re-snapshot on option changes', async () => {
            renderDialog('image');
            await waitFor(() => expect(mockPreviewImage).toHaveBeenCalled());
            await waitFor(() =>
                expect(
                    screen.getByRole('button', { name: 'Скачать' })
                ).toBeEnabled()
            );
            expect(mockPreviewImage).toHaveBeenCalledTimes(1);
            expect(mockPreviewImage).toHaveBeenCalledWith('png', {
                transparent: true,
                includePatternBG: false,
            });

            fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
            fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
            fireEvent.click(screen.getByLabelText('Сетка на фоне'));
            await new Promise((resolve) => setTimeout(resolve, 400));

            expect(mockPreviewImage).toHaveBeenCalledTimes(1);
        });

        it('keeps download disabled while the preview is being built', async () => {
            let finish: (url: string) => void = () => undefined;
            mockPreviewImage.mockImplementationOnce(
                () => new Promise<string>((resolve) => (finish = resolve))
            );
            renderDialog('image');
            await waitFor(() => expect(mockPreviewImage).toHaveBeenCalled());
            expect(
                screen.getByRole('button', { name: 'Скачать' })
            ).toBeDisabled();

            finish('data:image/png;base64,PREVIEW');
            await waitFor(() =>
                expect(
                    screen.getByRole('button', { name: 'Скачать' })
                ).toBeEnabled()
            );
        });

        it('shows an error when saving the image fails', async () => {
            mockExportImage.mockRejectedValueOnce(new Error('boom'));
            renderDialog('image');
            await clickDownload();
            expect(
                await screen.findByText(/Не удалось сохранить изображение/)
            ).toBeInTheDocument();
        });

        it('has no transparency for JPG', async () => {
            renderDialog('image');
            fireEvent.click(screen.getByLabelText('Прозрачный фон'));
            fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
            expect(screen.getByLabelText('Прозрачный фон')).toBeDisabled();
            await clickDownload();
            await waitFor(() =>
                expect(mockExportImage).toHaveBeenCalledWith('jpeg', {
                    scale: 2,
                    transparent: false,
                    includePatternBG: false,
                })
            );
            expect(account.trackEvent).toHaveBeenCalledWith(
                'erd2_export',
                expect.any(String),
                expect.objectContaining({ format: 'jpg' })
            );
        });

        it('hides the transparency checkbox for SVG (it has no effect there) and shows it again for PNG', async () => {
            renderDialog('image');
            expect(screen.getByLabelText('Прозрачный фон')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
            expect(
                screen.queryByLabelText('Прозрачный фон')
            ).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
            expect(screen.getByLabelText('Прозрачный фон')).toBeInTheDocument();
        });
    });

    describe('sql tab', () => {
        it('enables available dialects and marks the rest as coming soon', () => {
            renderDialog('sql');
            expect(screen.getByRole('button', { name: /MySQL/ })).toBeEnabled();
            expect(
                screen.getByRole('button', { name: /SQL Server/ })
            ).toBeEnabled();
            const oracle = screen.getByRole('button', { name: /Oracle/ });
            expect(oracle).toBeDisabled();
            expect(within(oracle).getByText('скоро')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /SQLite/ })
            ).toBeDisabled();
        });

        it('switches the script when another dialect is chosen', () => {
            renderDialog('sql');
            const pg = screen.getByTestId('code').textContent;
            fireEvent.click(screen.getByRole('button', { name: /MySQL/ }));
            expect(screen.getByTestId('code').textContent).not.toBe(pg);
        });

        it('downloads a .sql file named after the diagram and tracks it', () => {
            renderDialog('sql');
            fireEvent.click(screen.getByRole('button', { name: /MySQL/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
            expect(download.downloadText).toHaveBeenCalledWith(
                'shop.sql',
                expect.stringContaining('CREATE TABLE')
            );
            expect(account.trackEvent).toHaveBeenCalledWith(
                'erd2_export',
                expect.any(String),
                {
                    format: 'sql',
                    db_type: 'mysql',
                    action: 'download',
                }
            );
        });

        it('copies the script and tracks the copy without nudging for a review', async () => {
            renderDialog('sql');
            fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
            await waitFor(() => expect(download.copyText).toHaveBeenCalled());
            expect(account.trackEvent).toHaveBeenCalledWith(
                'erd2_export',
                expect.any(String),
                {
                    format: 'sql',
                    db_type: 'postgresql',
                    action: 'copy',
                }
            );
            expect(reviewEvents.emitReviewSignal).not.toHaveBeenCalled();
        });

        it('shows a hint instead of code for an empty diagram', () => {
            mockDiagram = { ...shopDiagram(), tables: [], relationships: [] };
            renderDialog('sql');
            expect(
                screen.getByText('В схеме пока нет таблиц')
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Скачать' })
            ).toBeDisabled();
        });

        it('starts on Generic for a dialect without a native exporter', () => {
            mockDiagram = {
                ...shopDiagram(),
                databaseType: DatabaseType.ORACLE,
            };
            renderDialog('sql');
            expect(
                screen.getByRole('button', { name: /Generic/ })
            ).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('formats tab', () => {
        it('shows DBML first, then Mermaid, Markdown and JSON', () => {
            renderDialog('formats');
            expect(screen.getByTestId('code').textContent).toContain('Table');
            fireEvent.click(screen.getByRole('button', { name: /Mermaid/ }));
            expect(screen.getByTestId('code').textContent).toContain(
                'erDiagram'
            );
            fireEvent.click(screen.getByRole('button', { name: /Markdown/ }));
            expect(screen.getByTestId('code').textContent).toContain(
                '| Поле | Тип |'
            );
            fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
            expect(screen.getByTestId('code').textContent).toContain(
                '"tables"'
            );
        });

        it('downloads with the right extension', () => {
            renderDialog('formats');
            fireEvent.click(screen.getByRole('button', { name: /Mermaid/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
            expect(download.downloadText).toHaveBeenCalledWith(
                'shop.mmd',
                expect.stringContaining('erDiagram'),
                expect.any(String)
            );
            expect(account.trackEvent).toHaveBeenCalledWith(
                'erd2_export',
                expect.any(String),
                {
                    format: 'mermaid',
                    db_type: 'postgresql',
                    action: 'download',
                }
            );
        });
    });

    describe('export scope', () => {
        it('does not render the scope toggle on the sql tab when no filter is active', () => {
            renderDialog('sql');
            expect(
                screen.queryByRole('radio', { name: 'Вся схема' })
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('radio', { name: 'Только видимое' })
            ).not.toBeInTheDocument();
        });

        it('does not render the scope toggle on the formats tab when no filter is active', () => {
            renderDialog('formats');
            expect(
                screen.queryByRole('radio', { name: 'Вся схема' })
            ).not.toBeInTheDocument();
        });

        describe('with a filter hiding the orders table', () => {
            beforeEach(() => {
                // shopDiagram() has tables t-users (users) and t-orders (orders);
                // this filter keeps only users visible.
                mockFilter = { tableIds: ['t-users'] };
            });

            it('shows the toggle on the sql tab, defaults to "visible only", and switching to "full" restores the hidden table', () => {
                renderDialog('sql');
                expect(
                    screen.getByRole('radio', { name: 'Только видимое' })
                ).toHaveAttribute('aria-checked', 'true');
                expect(
                    screen.getByRole('radio', { name: 'Вся схема' })
                ).toHaveAttribute('aria-checked', 'false');
                expect(screen.getByTestId('code').textContent).not.toContain(
                    'CREATE TABLE "orders"'
                );

                fireEvent.click(
                    screen.getByRole('radio', { name: 'Вся схема' })
                );
                expect(screen.getByTestId('code').textContent).toContain(
                    'CREATE TABLE "orders"'
                );
            });

            it('shows the toggle on the formats tab and applies scope to the JSON format', () => {
                renderDialog('formats');
                fireEvent.click(screen.getByRole('button', { name: /JSON/ }));
                expect(
                    screen.getByText('Копия схемы в JSON')
                ).toBeInTheDocument();
                expect(
                    screen.queryByText('Полная копия схемы')
                ).not.toBeInTheDocument();
                expect(screen.getByTestId('code').textContent).not.toContain(
                    'orders'
                );

                fireEvent.click(
                    screen.getByRole('radio', { name: 'Вся схема' })
                );
                expect(screen.getByTestId('code').textContent).toContain(
                    'orders'
                );
            });

            it('does not render the toggle while the image tab is active, even with an active filter', () => {
                renderDialog('image');
                expect(
                    screen.queryByRole('radio', { name: 'Вся схема' })
                ).not.toBeInTheDocument();
                expect(
                    screen.queryByRole('radio', { name: 'Только видимое' })
                ).not.toBeInTheDocument();
            });
        });
    });
});
