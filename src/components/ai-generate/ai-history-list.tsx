import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/button/button';
import { pluralTables } from '@/lib/ai-generate/format';
import type { AiHistoryItem } from '@/lib/ai-generate/types';

export interface AiHistoryListProps {
    items: AiHistoryItem[];
    loaded: boolean;
    disabled: boolean;
    onOpen: (id: string) => void;
    onRegenerate: (item: AiHistoryItem) => void;
    onDelete: (id: string) => void;
}

const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
          });
};

export const AiHistoryList: React.FC<AiHistoryListProps> = ({
    items,
    loaded,
    disabled,
    onOpen,
    onRegenerate,
    onDelete,
}) => {
    if (loaded && items.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                Здесь появятся ваши генерации. Любой вариант можно открыть
                заново — это не тратит попытки.
            </p>
        );
    }
    return (
        <ul className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
            {items.map((item) => (
                <li key={item.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{item.prompt}</p>
                        <button
                            type="button"
                            aria-label="Удалить из списка"
                            onClick={() => onDelete(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                        {item.table_count != null
                            ? ` · ${pluralTables(item.table_count)}`
                            : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tables.map((name) => (
                            <span
                                key={name}
                                className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            disabled={disabled}
                            onClick={() => onOpen(item.id)}
                        >
                            Открыть
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => onRegenerate(item)}
                        >
                            Сгенерировать заново
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    );
};
