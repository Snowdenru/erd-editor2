import { useEffect } from 'react';
import type React from 'react';
import { useReactFlow } from '@xyflow/react';
import type { DBTable } from '@/lib/domain/db-table';
import { MID_TABLE_SIZE } from '@/lib/domain/db-table';

const VIEWPORT_PADDING = 24;
const TABLE_HEADER_HEIGHT = 48;
const TABLE_ROW_HEIGHT = 32;
const MAX_ZOOM = 1;

// fitView в холсте не видит скрытые (не отрисованные) таблицы, поэтому область просмотра считаем сами
export const FitToTables: React.FC<{
    tables: DBTable[];
    containerRef: React.RefObject<HTMLDivElement>;
}> = ({ tables, containerRef }) => {
    const { setViewport } = useReactFlow();

    useEffect(() => {
        const container = containerRef.current;
        if (!container || tables.length === 0) {
            return;
        }

        const minX = Math.min(...tables.map((t) => t.x));
        const minY = Math.min(...tables.map((t) => t.y));
        const maxX = Math.max(
            ...tables.map((t) => t.x + (t.width ?? MID_TABLE_SIZE))
        );
        const maxY = Math.max(
            ...tables.map(
                (t) =>
                    t.y +
                    TABLE_HEADER_HEIGHT +
                    t.fields.length * TABLE_ROW_HEIGHT
            )
        );

        const { width, height } = container.getBoundingClientRect();
        const zoom = Math.min(
            MAX_ZOOM,
            (width - VIEWPORT_PADDING * 2) / (maxX - minX),
            (height - VIEWPORT_PADDING * 2) / (maxY - minY)
        );
        const viewport = {
            zoom,
            x: (width - (maxX - minX) * zoom) / 2 - minX * zoom,
            y: (height - (maxY - minY) * zoom) / 2 - minY * zoom,
        };

        // Холст может сам сдвинуть вид после старта — повторяем чуть позже
        const timers = [100, 600].map((delay) =>
            setTimeout(() => setViewport(viewport), delay)
        );
        return () => timers.forEach(clearTimeout);
    }, [tables, containerRef, setViewport]);

    return null;
};
