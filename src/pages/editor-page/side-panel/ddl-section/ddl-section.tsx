import React, { useEffect, useMemo, useState } from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';

const DDL_DEBOUNCE_MS = 300;

export const DDLSection: React.FC = () => {
    const { currentDiagram } = useChartDB();
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

    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <AuthBlurGate>
                    <CodeSnippet
                        code={ddl}
                        className="my-0.5"
                        language="sql"
                        actionsTooltipSide="right"
                        editorProps={{
                            options: { readOnly: true },
                        }}
                    />
                </AuthBlurGate>
            </div>
        </section>
    );
};
