import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import { MID_TABLE_SIZE } from '@/lib/domain/db-table';

const CARD_HEADER_HEIGHT = 28;
const CARD_ROW_HEIGHT = 20;
const MAX_VISIBLE_FIELDS = 5;
const VIEWPORT_PADDING = 24;
const PREVIEW_HEIGHT = 220;

function cardWidth(table: DBTable): number {
    return table.width ?? MID_TABLE_SIZE;
}

function cardHeight(table: DBTable): number {
    const fieldCount = table.fields.length;
    const visibleRows = Math.min(fieldCount, MAX_VISIBLE_FIELDS);
    const hasMoreRow = fieldCount > MAX_VISIBLE_FIELDS ? 1 : 0;
    return CARD_HEADER_HEIGHT + (visibleRows + hasMoreRow) * CARD_ROW_HEIGHT;
}

export interface DdlLivePreviewProps {
    diagram?: Diagram;
}

export const DdlLivePreview: React.FC<DdlLivePreviewProps> = ({ diagram }) => {
    const { t } = useTranslation();
    const tables = diagram?.tables ?? [];
    const relationships = diagram?.relationships ?? [];

    const referencedFieldIds = useMemo(
        () =>
            new Set(
                relationships.flatMap((relationship) => [
                    relationship.sourceFieldId,
                    relationship.targetFieldId,
                ])
            ),
        [relationships]
    );

    const tableById = useMemo(
        () => new Map(tables.map((table) => [table.id, table])),
        [tables]
    );

    const viewBox = useMemo(() => {
        if (tables.length === 0) {
            return null;
        }

        const minX = Math.min(...tables.map((table) => table.x));
        const minY = Math.min(...tables.map((table) => table.y));
        const maxX = Math.max(
            ...tables.map((table) => table.x + cardWidth(table))
        );
        const maxY = Math.max(
            ...tables.map((table) => table.y + cardHeight(table))
        );

        return {
            x: minX - VIEWPORT_PADDING,
            y: minY - VIEWPORT_PADDING,
            width: maxX - minX + VIEWPORT_PADDING * 2,
            height: maxY - minY + VIEWPORT_PADDING * 2,
        };
    }, [tables]);

    if (!viewBox) {
        return (
            <div
                data-testid="ddl-live-preview-empty"
                className="flex h-[120px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
            >
                {t('new_diagram_dialog.import_database.live_preview.empty')}
            </div>
        );
    }

    return (
        <svg
            data-testid="ddl-live-preview"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            width="100%"
            height={PREVIEW_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            className="rounded-md border bg-muted/20"
        >
            {relationships.map((relationship) => {
                const sourceTable = tableById.get(relationship.sourceTableId);
                const targetTable = tableById.get(relationship.targetTableId);
                if (!sourceTable || !targetTable) {
                    return null;
                }

                const x1 = sourceTable.x + cardWidth(sourceTable) / 2;
                const y1 = sourceTable.y + cardHeight(sourceTable) / 2;
                const x2 = targetTable.x + cardWidth(targetTable) / 2;
                const y2 = targetTable.y + cardHeight(targetTable) / 2;

                return (
                    <line
                        key={relationship.id}
                        data-testid="ddl-live-preview-relationship"
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        strokeWidth={1.5}
                        className="stroke-muted-foreground"
                    />
                );
            })}

            {tables.map((table) => {
                const width = cardWidth(table);
                const height = cardHeight(table);
                const visibleFields = table.fields.slice(0, MAX_VISIBLE_FIELDS);
                const hiddenCount = table.fields.length - visibleFields.length;

                return (
                    <g
                        key={table.id}
                        data-testid="ddl-live-preview-table"
                        transform={`translate(${table.x}, ${table.y})`}
                    >
                        <rect
                            width={width}
                            height={height}
                            rx={4}
                            strokeWidth={1}
                            className="fill-background stroke-border"
                        />
                        <text x={8} y={18} className="fill-foreground text-[13px] font-semibold">
                            {table.name}
                        </text>
                        {visibleFields.map((field, index) => {
                            const badge = field.primaryKey
                                ? 'PK'
                                : referencedFieldIds.has(field.id)
                                  ? 'FK'
                                  : null;

                            return (
                                <text
                                    key={field.id}
                                    x={8}
                                    y={CARD_HEADER_HEIGHT + index * CARD_ROW_HEIGHT + 14}
                                    className="fill-muted-foreground text-[11px]"
                                >
                                    {field.name}
                                    {badge ? ` (${badge})` : ''}
                                </text>
                            );
                        })}
                        {hiddenCount > 0 ? (
                            <text
                                x={8}
                                y={
                                    CARD_HEADER_HEIGHT +
                                    visibleFields.length * CARD_ROW_HEIGHT +
                                    14
                                }
                                className="fill-muted-foreground text-[11px] italic"
                            >
                                +{hiddenCount}{' '}
                                {t('new_diagram_dialog.import_database.live_preview.more_fields')}
                            </text>
                        ) : null}
                    </g>
                );
            })}
        </svg>
    );
};
