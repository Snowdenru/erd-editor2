import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/button/button';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { useAiRefineContext } from '@/components/ai-generate/ai-refine-context';
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
    const ai = useAiRefineContext();
    const { fitView } = useReactFlow();
    const fitTimer = useRef<ReturnType<typeof setTimeout>>();

    // После применения (canUndo false -> true) возвращаем холст в кадр
    const prevCanUndo = useRef(ai.canUndo);
    useEffect(() => {
        if (ai.canUndo && !prevCanUndo.current) {
            fitTimer.current = setTimeout(
                () => fitView({ padding: 0.15, duration: 200, maxZoom: 1 }),
                FIT_VIEW_DELAY_MS
            );
        }
        prevCanUndo.current = ai.canUndo;
    }, [ai.canUndo, fitView]);
    useEffect(() => () => clearTimeout(fitTimer.current), []);

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
                        onClick={() => {
                            ai.clearError();
                            setTab(key);
                        }}
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
                        {ai.proposal ? (
                            <p className="text-sm text-muted-foreground">
                                Есть неприменённое предложение ИИ — откройте
                                вкладку «Улучшить» или «Доработать», чтобы
                                применить или отменить его.
                            </p>
                        ) : null}
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
