// src/components/export-dialog/formats-tab.tsx
import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/toast/use-toast';
import type { Diagram } from '@/lib/domain/diagram';
import { generateDBMLFromDiagram } from '@/lib/dbml/dbml-export/dbml-export';
import { diagramToJSONOutput } from '@/lib/export-import-utils';
import { copyText, downloadText } from '@/lib/export/download';
import { exportFileName } from '@/lib/export/file-name';
import { diagramToMarkdown } from '@/lib/export/markdown';
import { diagramToMermaid } from '@/lib/export/mermaid';
import { cn } from '@/lib/utils';
import { ExportPreview } from './export-preview';
import type { ExportedInfo } from './export-dialog';

type FormatId = 'dbml' | 'mermaid' | 'markdown' | 'json';

interface FormatDef {
    id: FormatId;
    label: string;
    hint: string;
    extension: string;
    mime: string;
    language?: 'dbml';
    build: (diagram: Diagram) => { code: string; error?: string };
}

const FORMATS: FormatDef[] = [
    {
        id: 'dbml',
        label: 'DBML',
        hint: 'Для dbdiagram.io и dbdocs',
        extension: 'dbml',
        mime: 'text/plain;charset=utf-8',
        language: 'dbml',
        build: (diagram) => {
            const result = generateDBMLFromDiagram(diagram);
            return result.error
                ? {
                      code: '',
                      error: 'Не удалось сформировать DBML для этой схемы',
                  }
                : { code: result.standardDbml };
        },
    },
    {
        id: 'mermaid',
        label: 'Mermaid',
        hint: 'Для GitHub README, Notion, Confluence',
        extension: 'mmd',
        mime: 'text/plain;charset=utf-8',
        build: (diagram) => ({ code: diagramToMermaid(diagram) }),
    },
    {
        id: 'markdown',
        label: 'Markdown',
        hint: 'Справочник таблиц и полей',
        extension: 'md',
        mime: 'text/markdown;charset=utf-8',
        build: (diagram) => ({ code: diagramToMarkdown(diagram) }),
    },
    {
        id: 'json',
        label: 'JSON',
        hint: 'Копия схемы в JSON',
        extension: 'json',
        mime: 'application/json',
        build: (diagram) => ({ code: diagramToJSONOutput(diagram) }),
    },
];

export interface FormatsTabProps {
    diagram: Diagram;
    onExported: (info: ExportedInfo) => void;
}

export const FormatsTab: React.FC<FormatsTabProps> = ({
    diagram,
    onExported,
}) => {
    const { toast } = useToast();
    const [formatId, setFormatId] = useState<FormatId>('dbml');
    const format = FORMATS.find((f) => f.id === formatId) as FormatDef;

    const { code, error } = useMemo(() => {
        try {
            return format.build(diagram);
        } catch {
            return {
                code: '',
                error: 'Не удалось сформировать файл для этой схемы',
            };
        }
    }, [diagram, format]);

    const info = (action: 'download' | 'copy'): ExportedInfo => ({
        format: format.id,
        action,
    });

    const handleCopy = async () => {
        if (await copyText(code)) {
            toast({ title: 'Скопировано' });
            onExported(info('copy'));
        } else {
            toast({ title: 'Не удалось скопировать', variant: 'destructive' });
        }
    };

    const handleDownload = () => {
        downloadText(
            exportFileName(diagram.name, format.extension),
            code,
            format.mime
        );
        onExported(info('download'));
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {FORMATS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={formatId === item.id}
                        onClick={() => setFormatId(item.id)}
                        className={cn(
                            'rounded-md border p-3 text-left transition-colors hover:bg-accent',
                            formatId === item.id &&
                                'border-primary bg-primary/10'
                        )}
                    >
                        <span className="block text-sm font-medium">
                            {item.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            {item.hint}
                        </span>
                    </button>
                ))}
            </div>
            <ExportPreview
                code={code}
                language={format.language}
                error={error}
                emptyText="В схеме пока нет таблиц"
                onCopy={() => void handleCopy()}
                onDownload={handleDownload}
            />
        </div>
    );
};
