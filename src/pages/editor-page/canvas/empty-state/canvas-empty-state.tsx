import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Plus } from 'lucide-react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useDialog } from '@/hooks/use-dialog';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';

const CanvasEmptyStateExamples = React.lazy(() =>
    import('./canvas-empty-state-examples').then((module) => ({
        default: module.CanvasEmptyStateExamples,
    }))
);

export const CanvasEmptyState: React.FC = () => {
    const { t } = useTranslation();
    const { createTable } = useChartDB();
    const { openCreateDiagramDialog } = useDialog();

    return (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border bg-background/95 p-6 text-center shadow-sm backdrop-blur-sm">
                <p className="text-sm font-medium">
                    {t('canvas_empty_state.title')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                        type="button"
                        variant="default"
                        onClick={() => openCreateDiagramDialog()}
                    >
                        <Database className="mr-1.5 size-4" />
                        {t('canvas_empty_state.import_from_database')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void createTable()}
                    >
                        <Plus className="mr-1.5 size-4" />
                        {t('canvas_empty_state.new_table')}
                    </Button>
                </div>
                <Suspense fallback={<Spinner size="small" />}>
                    <CanvasEmptyStateExamples />
                </Suspense>
            </div>
        </div>
    );
};
