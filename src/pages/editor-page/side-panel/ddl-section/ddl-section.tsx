import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartDB } from '@/hooks/use-chartdb';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { Button } from '@/components/button/button';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import type { Diagram } from '@/lib/domain/diagram';
import { DdlPasteEditor } from './ddl-paste-editor';

const DDL_DEBOUNCE_MS = 300;

type DdlMode = 'diagram' | 'custom';

export const DDLSection: React.FC = () => {
    const { t } = useTranslation();
    const { currentDiagram, updateDiagramData } = useChartDB();
    const [mode, setMode] = useState<DdlMode>('diagram');
    const [diagram, setDiagram] = useState(currentDiagram);

    // Пересобираем скрипт не на каждое нажатие клавиши, а после паузы
    useEffect(() => {
        const timeout = setTimeout(
            () => setDiagram(currentDiagram),
            DDL_DEBOUNCE_MS
        );
        return () => clearTimeout(timeout);
    }, [currentDiagram]);

    const ddl = useMemo(() => {
        if (!diagram.tables?.length) {
            return '';
        }
        try {
            return exportBaseSQL({
                diagram,
                targetDatabaseType: diagram.databaseType,
            });
        } catch {
            return '';
        }
    }, [diagram]);

    const handleApply = useCallback(
        async (next: Diagram) => {
            await updateDiagramData(next);
            setMode('diagram');
        },
        [updateDiagramData]
    );

    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <AuthBlurGate>
                    <div className="mb-1 flex shrink-0 gap-1">
                        <Button
                            size="sm"
                            variant={mode === 'diagram' ? 'secondary' : 'ghost'}
                            onClick={() => setMode('diagram')}
                        >
                            {t('side_panel.ddl_section.mode_diagram')}
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'custom' ? 'secondary' : 'ghost'}
                            onClick={() => setMode('custom')}
                        >
                            {t('side_panel.ddl_section.mode_custom')}
                        </Button>
                    </div>

                    {mode === 'diagram' ? (
                        <CodeSnippet
                            code={ddl}
                            className="my-0.5"
                            language="sql"
                            actionsTooltipSide="right"
                            editorProps={{
                                options: { readOnly: true },
                            }}
                        />
                    ) : (
                        <DdlPasteEditor
                            currentDiagram={currentDiagram}
                            onApply={handleApply}
                        />
                    )}
                </AuthBlurGate>
            </div>
        </section>
    );
};
