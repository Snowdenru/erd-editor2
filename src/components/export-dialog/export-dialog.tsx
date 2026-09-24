// src/components/export-dialog/export-dialog.tsx
import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/tabs/tabs';
import { useChartDB } from '@/hooks/use-chartdb';
import { useDiagramFilter } from '@/context/diagram-filter-context/use-diagram-filter';
import { applyFilterOnDiagram } from '@/lib/domain/diagram-filter/filter';
import type { ExportTab } from '@/lib/export-dialog-events';
import { emitReviewSignal } from '@/lib/review-events';
import { trackEvent } from '@/lib/sqllab-account';
import { FormatsTab } from './formats-tab';
import { ImageTab } from './image-tab';
import { SqlTab } from './sql-tab';

export interface ExportedInfo {
    format: string;
    action: 'download' | 'copy';
    dbType?: string;
}

export interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialTab?: ExportTab;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
    open,
    onOpenChange,
    initialTab = 'image',
}) => {
    const { currentDiagram } = useChartDB();
    const { filter } = useDiagramFilter();
    const [tab, setTab] = useState<ExportTab>(initialTab);

    // Экспортируем то, что видно на холсте: учитываем фильтр по схемам и таблицам
    const diagram = useMemo(
        () =>
            applyFilterOnDiagram({
                diagram: currentDiagram,
                filter: filter ?? {},
            }),
        [currentDiagram, filter]
    );

    const handleExported = (info: ExportedInfo) => {
        trackEvent('erd2_export', window.location.pathname, {
            format: info.format,
            db_type: info.dbType ?? currentDiagram.databaseType,
            action: info.action,
        });
        // Скачал — самый удачный момент попросить оценку (само приглашение сдерживает canAutoPrompt)
        if (info.action === 'download') {
            emitReviewSignal('nudge');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] min-h-[480px] max-w-4xl flex-col">
                <DialogHeader>
                    <DialogTitle>Экспорт схемы</DialogTitle>
                    <DialogDescription>
                        Скачайте схему как изображение, SQL для нужной СУБД или
                        файл для документации.
                    </DialogDescription>
                </DialogHeader>
                <Tabs
                    value={tab}
                    onValueChange={(value) => setTab(value as ExportTab)}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <TabsList className="self-start">
                        <TabsTrigger value="image">Изображение</TabsTrigger>
                        <TabsTrigger value="sql">SQL</TabsTrigger>
                        <TabsTrigger value="formats">Форматы</TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value="image"
                        className="flex-1 overflow-auto pt-2"
                    >
                        <ImageTab onExported={handleExported} />
                    </TabsContent>
                    <TabsContent
                        value="sql"
                        className="flex min-h-0 flex-1 flex-col pt-2"
                    >
                        <SqlTab diagram={diagram} onExported={handleExported} />
                    </TabsContent>
                    <TabsContent
                        value="formats"
                        className="flex min-h-0 flex-1 flex-col pt-2"
                    >
                        <FormatsTab
                            diagram={diagram}
                            onExported={handleExported}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
