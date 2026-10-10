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
import { ToggleGroup, ToggleGroupItem } from '@/components/toggle/toggle-group';
import { useChartDB } from '@/hooks/use-chartdb';
import { useDiagramFilter } from '@/context/diagram-filter-context/use-diagram-filter';
import { applyFilterOnDiagram } from '@/lib/domain/diagram-filter/filter';
import type { ExportTab } from '@/lib/export-dialog-events';
import { emitReviewSignal } from '@/lib/review-events';
import { trackEvent } from '@/lib/sqllab-account';
import { EmbedTab } from './embed-tab';
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
    const [scope, setScope] = useState<'visible' | 'full'>('visible');

    // То, что видно на холсте с учётом фильтра по схемам/таблицам
    const visibleDiagram = useMemo(
        () =>
            applyFilterOnDiagram({
                diagram: currentDiagram,
                filter: filter ?? {},
            }),
        [currentDiagram, filter]
    );

    const hasActiveFilter =
        Boolean(filter?.tableIds) || Boolean(filter?.schemaIds);

    // Пользователь явно выбирает: экспортировать только видимое или всю схему целиком
    const effectiveDiagram = scope === 'full' ? currentDiagram : visibleDiagram;

    const handleExported = (info: ExportedInfo) => {
        trackEvent('erd2_export', window.location.pathname, {
            format: info.format,
            db_type: info.dbType ?? currentDiagram.databaseType,
            action: info.action,
        });
        // Любой экспорт (скачал или скопировал) — удачный момент попросить оценку;
        // частоту сдерживает canExportPrompt (раз в 7 дней)
        emitReviewSignal('prompt');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showClose
                className="flex max-h-[85vh] min-h-[480px] max-w-4xl flex-col"
            >
                <DialogHeader>
                    <DialogTitle>Экспорт схемы</DialogTitle>
                    <DialogDescription>
                        Скачайте схему как изображение, SQL для нужной СУБД или
                        файл для документации, либо встройте её на сайт.
                    </DialogDescription>
                </DialogHeader>
                {hasActiveFilter && tab !== 'image' && tab !== 'embed' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                            Фильтр холста скрывает часть схемы: видно{' '}
                            {visibleDiagram.tables?.length ?? 0} из{' '}
                            {currentDiagram.tables?.length ?? 0} таблиц
                        </span>
                        <ToggleGroup
                            type="single"
                            value={scope}
                            onValueChange={(value) => {
                                if (value)
                                    setScope(value as 'visible' | 'full');
                            }}
                        >
                            <ToggleGroupItem
                                value="visible"
                                className="text-xs"
                            >
                                Только видимое
                            </ToggleGroupItem>
                            <ToggleGroupItem value="full" className="text-xs">
                                Вся схема
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                )}
                <Tabs
                    value={tab}
                    onValueChange={(value) => setTab(value as ExportTab)}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <TabsList className="self-start">
                        <TabsTrigger value="image">Изображение</TabsTrigger>
                        <TabsTrigger value="sql">SQL</TabsTrigger>
                        <TabsTrigger value="formats">Форматы</TabsTrigger>
                        <TabsTrigger value="embed">Встроить</TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value="image"
                        className="flex min-h-0 flex-1 flex-col pt-2 data-[state=inactive]:hidden"
                    >
                        <ImageTab onExported={handleExported} />
                    </TabsContent>
                    <TabsContent
                        value="sql"
                        className="flex min-h-0 flex-1 flex-col pt-2 data-[state=inactive]:hidden"
                    >
                        <SqlTab
                            diagram={effectiveDiagram}
                            onExported={handleExported}
                        />
                    </TabsContent>
                    <TabsContent
                        value="formats"
                        className="flex min-h-0 flex-1 flex-col pt-2 data-[state=inactive]:hidden"
                    >
                        <FormatsTab
                            diagram={effectiveDiagram}
                            onExported={handleExported}
                        />
                    </TabsContent>
                    <TabsContent
                        value="embed"
                        className="flex min-h-0 flex-1 flex-col pt-2 data-[state=inactive]:hidden"
                    >
                        <EmbedTab onClose={() => onOpenChange(false)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
