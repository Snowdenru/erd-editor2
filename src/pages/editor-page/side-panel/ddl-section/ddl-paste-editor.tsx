import React, {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Editor } from '@/components/code-snippet/code-snippet';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/components/toast/use-toast';
import { useAlert } from '@/context/alert-context/alert-context';
import { SQLValidationStatus } from '@/dialogs/common/import-database/sql-validation-status';
import { setupDBMLLanguage } from '@/components/code-snippet/languages/dbml-language';
import type { editor } from 'monaco-editor';
import type { Diagram } from '@/lib/domain/diagram';
import {
    parseDdl,
    replaceDiagramContent,
    type DdlParseResult,
} from './apply-ddl';

const PARSE_DEBOUNCE_MS = 500;

export interface DdlPasteEditorProps {
    currentDiagram: Diagram;
    sql: string;
    onSqlChange: (sql: string) => void;
    onApply: (diagram: Diagram) => Promise<void> | void;
}

export const DdlPasteEditor: React.FC<DdlPasteEditorProps> = ({
    currentDiagram,
    sql,
    onSqlChange,
    onApply,
}) => {
    const { t } = useTranslation();
    const { effectiveTheme } = useTheme();
    const { showAlert } = useAlert();
    const { toast } = useToast();
    // null — идёт разбор (после последнего ввода ещё не завершился)
    const [result, setResult] = useState<DdlParseResult | null>({
        status: 'empty',
    });
    const [applying, setApplying] = useState(false);
    const applyingRef = useRef(false);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    // Подтверждение может прийти позже клика: берём самую свежую диаграмму
    const currentDiagramRef = useRef(currentDiagram);
    currentDiagramRef.current = currentDiagram;
    const { databaseType } = currentDiagram;

    useEffect(() => {
        if (!sql.trim()) {
            setResult({ status: 'empty' });
            return;
        }

        let cancelled = false;
        setResult(null);
        const timer = setTimeout(async () => {
            let parsed: DdlParseResult;
            try {
                parsed = await parseDdl(sql, databaseType);
            } catch (error) {
                parsed = {
                    status: 'error',
                    message:
                        error instanceof Error ? error.message : String(error),
                    validation: { isValid: false, errors: [], warnings: [] },
                };
            }
            if (!cancelled) {
                setResult(parsed);
            }
        }, PARSE_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [sql, databaseType]);

    const applyParsed = useCallback(
        async (parsed: Diagram) => {
            if (applyingRef.current) {
                return;
            }
            applyingRef.current = true;
            setApplying(true);
            try {
                await onApply(
                    replaceDiagramContent(currentDiagramRef.current, parsed)
                );
                onSqlChange('');
            } catch (error) {
                // SQL остаётся в редакторе, чтобы можно было повторить
                console.error('Failed to apply DDL', error);
                toast({
                    variant: 'destructive',
                    title: t('side_panel.ddl_section.apply_failed_title'),
                    description: t(
                        'side_panel.ddl_section.apply_failed_description'
                    ),
                });
            } finally {
                applyingRef.current = false;
                setApplying(false);
            }
        },
        [onApply, onSqlChange, toast, t]
    );

    const handleApply = useCallback(() => {
        if (result?.status !== 'ok') {
            return;
        }
        const parsed = result.diagram;

        if ((currentDiagramRef.current.tables?.length ?? 0) === 0) {
            void applyParsed(parsed);
            return;
        }

        showAlert({
            title: t('side_panel.ddl_section.confirm_title'),
            description: t('side_panel.ddl_section.confirm_description'),
            actionLabel: t('side_panel.ddl_section.confirm_action'),
            closeLabel: t('side_panel.ddl_section.confirm_cancel'),
            onAction: () => void applyParsed(parsed),
        });
    }, [result, applyParsed, showAlert, t]);

    const statusMessage = useMemo(() => {
        if (result?.status === 'error') {
            return result.message;
        }
        if (result?.status === 'too-large') {
            return t('side_panel.ddl_section.too_large', {
                count: result.length,
                limit: result.limit,
            });
        }
        if (result?.status === 'too-many-tables') {
            return t('side_panel.ddl_section.too_many_tables', {
                count: result.count,
                limit: result.limit,
            });
        }
        if (result?.status === 'no-tables') {
            return t('side_panel.ddl_section.no_tables');
        }
        return '';
    }, [result, t]);

    const validation = useMemo(() => {
        if (
            !result ||
            result.status === 'empty' ||
            result.status === 'too-large'
        ) {
            return null;
        }
        if (result.status === 'syntax') {
            const keys = {
                'unbalanced-close': 'syntax_unbalanced_close',
                'unclosed-paren': 'syntax_unclosed_paren',
                'double-comma': 'syntax_double_comma',
                'comma-before-close': 'syntax_comma_before_close',
            } as const;
            return {
                ...result.validation,
                errors: [
                    {
                        line: result.line,
                        type: 'syntax' as const,
                        message: `${t(`side_panel.ddl_section.${keys[result.code]}`)} (${t('side_panel.ddl_section.syntax_at_line', { line: result.line })})`,
                    },
                ],
            };
        }
        return result.validation;
    }, [result, t]);

    const handleErrorClick = useCallback((line: number) => {
        const ed = editorRef.current;
        if (!ed) {
            return;
        }
        ed.revealLineInCenter(line);
        ed.setPosition({ lineNumber: line, column: 1 });
        ed.focus();
    }, []);

    return (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
            <div className="min-h-40 flex-1 overflow-hidden rounded-md border">
                <Suspense fallback={<Spinner />}>
                    <Editor
                        value={sql}
                        onChange={(value) => onSqlChange(value ?? '')}
                        language="sql"
                        onMount={(ed) => {
                            editorRef.current = ed;
                        }}
                        loading={<Spinner />}
                        beforeMount={setupDBMLLanguage}
                        theme={
                            effectiveTheme === 'dark'
                                ? 'dbml-dark'
                                : 'dbml-light'
                        }
                        options={{
                            editContext: false,
                            formatOnPaste: false,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            lineNumbers: 'on',
                            lineNumbersMinChars: 3,
                            renderValidationDecorations: 'off',
                            contextmenu: false,
                        }}
                        className="size-full"
                    />
                </Suspense>
            </div>

            <SQLValidationStatus
                validation={validation}
                errorMessage={statusMessage}
                onErrorClick={handleErrorClick}
            />

            <Button
                className="shrink-0"
                disabled={result?.status !== 'ok' || applying}
                onClick={handleApply}
            >
                {t('side_panel.ddl_section.apply')}
            </Button>
        </div>
    );
};
