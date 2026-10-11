import React from 'react';
import { AI_DIALECT_OPTIONS } from '@/lib/ai-generate/dialect';
import { AI_EXAMPLES } from '@/lib/ai-generate/examples';
import type { AiDialect } from '@/lib/ai-generate/types';

export const AI_PROMPT_MAX = 2000;

export interface AiPromptFieldProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    dialect: AiDialect;
    onDialectChange: (value: AiDialect) => void;
    disabled?: boolean;
    rows?: number;
}

export const AiPromptField: React.FC<AiPromptFieldProps> = ({
    prompt,
    onPromptChange,
    dialect,
    onDialectChange,
    disabled,
    rows = 4,
}) => (
    <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
            {AI_EXAMPLES.map((example) => (
                <button
                    key={example.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPromptChange(example.prompt)}
                    className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                    {example.label}
                </button>
            ))}
        </div>
        <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            disabled={disabled}
            rows={rows}
            maxLength={AI_PROMPT_MAX}
            aria-label="Описание базы данных"
            placeholder="Опишите вашу базу: например, «интернет-магазин с товарами, заказами и доставкой»"
            className="w-full resize-y rounded-xl border bg-card p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600"
        />
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Диалект:</span>
            {AI_DIALECT_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onDialectChange(option.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        dialect === option.value
                            ? 'border-pink-600 bg-pink-600 text-white'
                            : 'text-muted-foreground hover:bg-accent'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);
