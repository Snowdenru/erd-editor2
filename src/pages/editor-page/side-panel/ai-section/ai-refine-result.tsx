import React from 'react';
import { Button } from '@/components/button/button';
import type { RefineProposal } from '@/components/ai-generate/use-ai-refine';

export interface AiRefineResultProps {
    proposal: RefineProposal;
    busy: boolean;
    onApply: () => void;
    onDiscard: () => void;
}

export const AiRefineResult: React.FC<AiRefineResultProps> = ({
    proposal,
    busy,
    onApply,
    onDiscard,
}) => {
    const { changes, diff } = proposal;
    return (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-2">
            {changes.length > 0 ? (
                <section>
                    <h3 className="mb-1 text-sm font-semibold">
                        Что изменится
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {changes.map((c, i) => (
                            <li key={i}>{c}</li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section>
                <h3 className="mb-1 text-sm font-semibold">
                    Изменения в схеме
                </h3>
                <ul className="space-y-2 text-sm">
                    {diff.tables.map((t) => (
                        <li key={`${t.status}-${t.name}`}>
                            <span
                                className={
                                    t.status === 'added'
                                        ? 'font-mono text-green-600 dark:text-green-400'
                                        : t.status === 'removed'
                                          ? 'font-mono text-red-600 dark:text-red-400'
                                          : 'font-mono'
                                }
                            >
                                {t.status === 'added'
                                    ? `+ ${t.name} (полей: ${t.fieldCount})`
                                    : t.status === 'removed'
                                      ? `− ${t.name}`
                                      : `~ ${t.name}`}
                            </span>
                            {t.status === 'changed' ? (
                                <ul className="ml-4 mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    {t.addedFields.map((f) => (
                                        <li key={`+${f}`}>+ поле {f}</li>
                                    ))}
                                    {t.removedFields.map((f) => (
                                        <li key={`-${f}`}>− поле {f}</li>
                                    ))}
                                    {t.changedFields.map((f) => (
                                        <li key={`~${f.name}`}>
                                            ~ поле {f.name}:{' '}
                                            {f.changes.join(', ')}
                                        </li>
                                    ))}
                                    {t.addedIndexes.map((i) => (
                                        <li key={`+i${i}`}>+ индекс {i}</li>
                                    ))}
                                    {t.removedIndexes.map((i) => (
                                        <li key={`-i${i}`}>− индекс {i}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </li>
                    ))}
                    {diff.addedRelationships.map((r) => (
                        <li
                            key={`+r${r}`}
                            className="font-mono text-green-600 dark:text-green-400"
                        >
                            + связь {r}
                        </li>
                    ))}
                    {diff.removedRelationships.map((r) => (
                        <li
                            key={`-r${r}`}
                            className="font-mono text-red-600 dark:text-red-400"
                        >
                            − связь {r}
                        </li>
                    ))}
                </ul>
            </section>

            <div className="sticky bottom-0 flex gap-2 bg-background pt-2">
                <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={onApply}
                >
                    Применить всё
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={onDiscard}
                >
                    Отмена
                </Button>
            </div>
        </div>
    );
};
