import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useChartDB } from '@/hooks/use-chartdb';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { Button } from '@/components/button/button';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import type { Diagram } from '@/lib/domain/diagram';
import { DdlPasteEditor } from './ddl-paste-editor';

const DDL_DEBOUNCE_MS = 300;
const FIT_VIEW_DELAY_MS = 250;

type DdlMode = 'diagram' | 'custom';

export const DDLSection: React.FC = () => {
    const { t } = useTranslation();
    const { currentDiagram, updateDiagramData } = useChartDB();
    const [mode, setMode] = useState<DdlMode>('diagram');
    const { fitView } = useReactFlow();
    const currentDiagramRef = useRef(currentDiagram);
    currentDiagramRef.current = currentDiagram;
    const fitTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const [sql, setSql] = useState('');
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

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            clearTimeout(fitTimerRef.current);
        };
    }, []);

    const handleApply = useCallback(
        async (next: Diagram) => {
            const snapshot = currentDiagramRef.current;
            try {
                await updateDiagramData(next);
            } catch (error) {
                // Запись могла пройти частично: пробуем вернуть прежнее состояние
                try {
                    await updateDiagramData(snapshot);
                } catch (rollbackError) {
                    console.error('Failed to roll back diagram', rollbackError);
                }
                throw error;
            }
            if (!isMountedRef.current) {
                return;
            }
            setMode('diagram');
            // Даём узлам отрисоваться и возвращаем холст в кадр
            clearTimeout(fitTimerRef.current);
            fitTimerRef.current = setTimeout(
                () => fitView({ padding: 0.15, duration: 200, maxZoom: 1 }),
                FIT_VIEW_DELAY_MS
            );
        },
        [updateDiagramData, fitView]
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
                            className={
                                mode === 'diagram' ? '' : 'text-foreground'
                            }
                            onClick={() => setMode('diagram')}
                        >
                            {t('side_panel.ddl_section.mode_diagram')}
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'custom' ? 'secondary' : 'ghost'}
                            className={
                                mode === 'custom' ? '' : 'text-foreground'
                            }
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
                            sql={sql}
                            onSqlChange={setSql}
                            onApply={handleApply}
                        />
                    )}
                </AuthBlurGate>
            </div>
        </section>
    );
};
