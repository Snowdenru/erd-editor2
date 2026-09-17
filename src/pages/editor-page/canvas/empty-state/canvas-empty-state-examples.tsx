import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import { useExampleDiagrams } from '@/hooks/use-example-diagrams';
import { Spinner } from '@/components/spinner/spinner';
import type { Example } from '@/pages/examples-page/examples-data/examples-data';

export const CanvasEmptyStateExamples: React.FC = () => {
    const { t } = useTranslation();
    const { effectiveTheme } = useTheme();
    const { examples, loadingExampleId, utilizeExample } = useExampleDiagrams();

    const handleClick = (example: Example) => {
        utilizeExample({ example }).catch((error: unknown) => {
            console.error('Failed to clone example diagram', error);
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-center text-xs text-muted-foreground">
                {t(
                    'new_diagram_dialog.database_selection.quick_start_examples'
                )}
            </span>
            <div className="grid grid-cols-3 gap-2">
                {examples.map((example) => (
                    <button
                        key={example.id}
                        type="button"
                        onClick={() => handleClick(example)}
                        disabled={!!loadingExampleId}
                        className="flex flex-col items-center gap-1 rounded-md border p-1 text-center transition-colors hover:border-pink-600 disabled:opacity-50"
                    >
                        {loadingExampleId === example.id ? (
                            <Spinner size="small" />
                        ) : (
                            <img
                                src={
                                    effectiveTheme === 'dark'
                                        ? example.imageDark
                                        : example.image
                                }
                                alt={example.name}
                                className="h-16 w-full rounded object-cover"
                            />
                        )}
                        <span className="text-xs">{example.name}</span>
                    </button>
                ))}
            </div>
            <Link
                to="/templates"
                className="text-center text-xs text-primary hover:underline"
            >
                {t('new_diagram_dialog.database_selection.more_templates')}
            </Link>
        </div>
    );
};
