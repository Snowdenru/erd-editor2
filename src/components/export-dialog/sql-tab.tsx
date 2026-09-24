// src/components/export-dialog/sql-tab.tsx
import React, { useMemo, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/components/toast/use-toast';
import { databaseTypeToLabelMap, getDatabaseLogo } from '@/lib/databases';
import type { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { copyText, downloadText } from '@/lib/export/download';
import { exportFileName } from '@/lib/export/file-name';
import {
    SQL_TARGETS,
    generateSql,
    isSqlTargetAvailable,
    pickDefaultSqlTarget,
} from '@/lib/export/sql';
import { cn } from '@/lib/utils';
import { ExportPreview } from './export-preview';
import type { ExportedInfo } from './export-dialog';

export interface SqlTabProps {
    diagram: Diagram;
    onExported: (info: ExportedInfo) => void;
}

export const SqlTab: React.FC<SqlTabProps> = ({ diagram, onExported }) => {
    const { effectiveTheme } = useTheme();
    const { toast } = useToast();
    const [target, setTarget] = useState<DatabaseType>(() =>
        pickDefaultSqlTarget(diagram.databaseType)
    );

    const { code, error } = useMemo(() => {
        try {
            return { code: generateSql(diagram, target), error: undefined };
        } catch {
            return {
                code: '',
                error: 'Не удалось сформировать SQL для этой схемы',
            };
        }
    }, [diagram, target]);

    const info = (action: 'download' | 'copy'): ExportedInfo => ({
        format: 'sql',
        action,
        dbType: target,
    });

    const handleCopy = async () => {
        if (await copyText(code)) {
            toast({ title: 'SQL скопирован' });
            onExported(info('copy'));
        } else {
            toast({ title: 'Не удалось скопировать', variant: 'destructive' });
        }
    };

    const handleDownload = () => {
        downloadText(exportFileName(diagram.name, 'sql'), code);
        onExported(info('download'));
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {SQL_TARGETS.map((type) => {
                    const available = isSqlTargetAvailable(
                        diagram.databaseType,
                        type
                    );
                    const logo = getDatabaseLogo(type, effectiveTheme);
                    return (
                        <button
                            key={type}
                            type="button"
                            disabled={!available}
                            aria-pressed={target === type}
                            onClick={() => setTarget(type)}
                            className={cn(
                                'flex flex-col items-center gap-1 rounded-md border p-3 text-xs transition-colors',
                                target === type &&
                                    available &&
                                    'border-primary bg-primary/10',
                                available
                                    ? 'hover:bg-accent'
                                    : 'cursor-not-allowed opacity-50'
                            )}
                        >
                            {logo ? (
                                <img src={logo} alt="" className="h-6" />
                            ) : (
                                <span className="h-6" />
                            )}
                            <span className="font-medium">
                                {databaseTypeToLabelMap[type]}
                            </span>
                            {!available && (
                                <span className="text-[10px] text-muted-foreground">
                                    скоро
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <ExportPreview
                code={code}
                language="sql"
                error={error}
                emptyText="В схеме пока нет таблиц"
                onCopy={() => void handleCopy()}
                onDownload={handleDownload}
            />
        </div>
    );
};
