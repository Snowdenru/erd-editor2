import React, { useMemo, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/pages/editor-page/canvas/canvas';
import { ChartDBProvider } from '@/context/chartdb-context/chartdb-provider';
import { DiffProvider } from '@/context/diff-context/diff-provider';
import { colorOptions } from '@/lib/colors';
import type { Diagram } from '@/lib/domain/diagram';
import { FitToTables } from '@/components/fit-to-tables/fit-to-tables';

export interface DdlCanvasPreviewProps {
    diagram: Diagram;
}

// Тот же холст, что в редакторе (только чтение): карточки таблиц выглядят так же, как после открытия схемы
export const DdlCanvasPreview: React.FC<DdlCanvasPreviewProps> = ({
    diagram,
}) => {
    // Импорт красит все таблицы одним цветом — для превью раскрашиваем по палитре редактора
    const coloredDiagram = useMemo<Diagram>(
        () => ({
            ...diagram,
            tables: diagram.tables?.map((table, index) => ({
                ...table,
                color: colorOptions[index % colorOptions.length],
            })),
        }),
        [diagram]
    );

    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={containerRef}
            className="h-[420px] overflow-hidden rounded-2xl border bg-background shadow-sm"
        >
            <ReactFlowProvider>
                <DiffProvider>
                    <ChartDBProvider
                        key={coloredDiagram.id}
                        diagram={coloredDiagram}
                        readonly
                    >
                        <Canvas initialTables={coloredDiagram.tables ?? []} />
                        <FitToTables
                            tables={coloredDiagram.tables ?? []}
                            containerRef={containerRef}
                        />
                    </ChartDBProvider>
                </DiffProvider>
            </ReactFlowProvider>
        </div>
    );
};
