// src/components/export-dialog/export-preview.tsx
import React from 'react';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/button/button';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';

export interface ExportPreviewProps {
    code: string;
    language?: 'sql' | 'dbml';
    emptyText: string;
    error?: string;
    onCopy: () => void;
    onDownload: () => void;
}

export const ExportPreview: React.FC<ExportPreviewProps> = ({
    code,
    language,
    emptyText,
    error,
    onCopy,
    onDownload,
}) => {
    const disabled = !code;
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={onCopy}
                >
                    <Copy /> Копировать
                </Button>
                <Button
                    type="button"
                    size="sm"
                    disabled={disabled}
                    onClick={onDownload}
                >
                    <Download /> Скачать
                </Button>
            </div>
            <div className="min-h-[240px] flex-1 overflow-auto rounded-md border bg-muted/30">
                {error ? (
                    <p className="p-4 text-sm text-destructive">{error}</p>
                ) : !code ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        {emptyText}
                    </p>
                ) : language ? (
                    <CodeSnippet
                        code={code}
                        language={language}
                        allowCopy={false}
                        className="h-full"
                    />
                ) : (
                    <pre
                        data-testid="code"
                        className="p-4 text-xs leading-relaxed"
                    >
                        {code}
                    </pre>
                )}
            </div>
        </div>
    );
};
