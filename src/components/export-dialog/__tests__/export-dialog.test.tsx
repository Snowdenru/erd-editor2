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
import * as account from '@/lib/sqllab-account';
import * as download from '@/lib/export/download';
import * as reviewEvents from '@/lib/review-events';
import { shopDiagram } from '@/lib/export/__tests__/fixtures';
import { ExportDialog } from '../export-dialog';

let mockDiagram = shopDiagram();
const mockExportImage = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ currentDiagram: mockDiagram }),
}));
vi.mock('@/context/diagram-filter-context/use-diagram-filter', () => ({
    useDiagramFilter: () => ({ filter: {} }),
}));
vi.mock('@/hooks/use-export-image', () => ({
    useExportImage: () => ({ exportImage: mockExportImage }),
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

describe('ExportDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockDiagram = shopDiagram();
        mockExportImage.mockClear();
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
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
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
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
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
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
            await waitFor(() =>
                expect(mockExportImage).toHaveBeenLastCalledWith('png', {
                    scale: 3,
                    transparent: true,
                    includePatternBG: true,
                })
            );
        });

        it('has no transparency for JPG', async () => {
            renderDialog('image');
            fireEvent.click(screen.getByLabelText('Прозрачный фон'));
            fireEvent.click(screen.getByRole('button', { name: 'JPG' }));
            expect(screen.getByLabelText('Прозрачный фон')).toBeDisabled();
            fireEvent.click(screen.getByRole('button', { name: 'Скачать' }));
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
});
