import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/button/button';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { useAiRefine } from '@/components/ai-generate/use-ai-refine';
import { emitOpenAiGenerate } from '@/lib/ai-generate/events';
import { AiRefinePanel } from './ai-refine-panel';

type Tab = 'create' | 'review' | 'edit';

const TABS: { key: Tab; label: string }[] = [
    { key: 'create', label: 'Создать' },
    { key: 'review', label: 'Улучшить' },
    { key: 'edit', label: 'Доработать' },
];

const FIT_VIEW_DELAY_MS = 250;

export const AiSection: React.FC = () => {
    const [tab, setTab] = useState<Tab>('create');
    const [prompt, setPrompt] = useState('');
    const ai = useAiRefine();
    const { fitView } = useReactFlow();
    const fitTimer = useRef<ReturnType<typeof setTimeout>>();

    // После применения возвращаем холст в кадр, чтобы новые таблицы были видны
    const wasProposal = useRef(false);
    useEffect(() => {
        const has = ai.proposal !== null;
        if (wasProposal.current && !has && ai.canUndo) {
            clearTimeout(fitTimer.current);
            fitTimer.current = setTimeout(
                () => fitView({ padding: 0.15, duration: 200, maxZoom: 1 }),
                FIT_VIEW_DELAY_MS
            );
        }
        wasProposal.current = has;
        return () => clearTimeout(fitTimer.current);
    }, [ai.proposal, ai.canUndo, fitView]);

    const openGenerate = useCallback(() => {
        emitOpenAiGenerate({ source: 'sidebar', prompt: prompt.trim() });
    }, [prompt]);

    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div role="tablist" className="mb-2 flex shrink-0 gap-1 border-b">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`ai-tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls="ai-tabpanel"
                        onClick={() => setTab(key)}
                        className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                            tab === key
                                ? 'border-pink-600 text-foreground'
                                : 'border-transparent text-muted-foreground'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div
                id="ai-tabpanel"
                role="tabpanel"
                aria-labelledby={`ai-tab-${tab}`}
                className="flex flex-1 flex-col overflow-hidden"
            >
                {tab === 'create' ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            Опишите предметную область — ИИ создаст новую схему
                            с таблицами, связями и индексами.
                        </p>
                        <textarea
                            aria-label="Описание новой схемы"
                            value={prompt}
                            rows={3}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Например: школа с классами, учителями и оценками"
                            className="w-full resize-none rounded-md border bg-background p-2 text-sm"
                        />
                        <div>
                            <Button
                                type="button"
                                size="sm"
                                onClick={openGenerate}
                            >
                                Описать схему
                            </Button>
                        </div>
                    </div>
                ) : (
                    <AuthBlurGate>
                        <AiRefinePanel mode={tab} ai={ai} />
                    </AuthBlurGate>
                )}
            </div>
        </section>
    );
};
