import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { pluralTables } from '@/lib/ai-generate/format';
import type { AiDialect, AiHistoryItem } from '@/lib/ai-generate/types';
import { AiHistoryList } from './ai-history-list';
import { AI_PROMPT_MAX, AiPromptField } from './ai-prompt-field';
import type { AiGenerateApi, AiUiError } from './use-ai-generate';

const MIN_PROMPT = 3;

const ERROR_TEXT: Record<
    Exclude<AiUiError, 'limit_free' | 'limit_daily'>,
    string
> = {
    off_topic:
        'Это не похоже на описание базы данных. Опишите, какие данные нужно хранить — попытка не потрачена.',
    provider:
        'Сервис генерации временно недоступен. Попробуйте ещё раз через минуту — попытка не потрачена.',
    parse: 'Не удалось собрать диаграмму из ответа ИИ. Попробуйте ещё раз или измените описание.',
    cooldown: 'Подождите несколько секунд перед следующей генерацией.',
    network:
        'Не удалось связаться с сервером. Проверьте соединение и что вы вошли в аккаунт, затем повторите.',
    save: 'Не удалось сохранить схему на устройстве. Попытка возвращена — повторите.',
    invalid_prompt: 'Опишите базу подробнее: нужно от 3 до 2000 символов.',
};

export interface AiGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ai: AiGenerateApi;
    initialPrompt: string;
    initialDialect: AiDialect;
    onSubmit: (prompt: string, dialect: AiDialect) => void;
}

type Tab = 'new' | 'history';

export const AiGenerateDialog: React.FC<AiGenerateDialogProps> = ({
    open,
    onOpenChange,
    ai,
    initialPrompt,
    initialDialect,
    onSubmit,
}) => {
    const [tab, setTab] = useState<Tab>('new');
    const [prompt, setPrompt] = useState(initialPrompt);
    const [dialect, setDialect] = useState<AiDialect>(initialDialect);
    const [showSql, setShowSql] = useState(false);

    useEffect(() => {
        if (open) {
            setPrompt(initialPrompt);
            setDialect(initialDialect);
            setTab('new');
            setShowSql(false);
        }
    }, [open, initialPrompt, initialDialect]);

    // В хуке нет очистки при размонтировании: закрытие диалога обрывает генерацию здесь.
    const aiRef = useRef(ai);
    aiRef.current = ai;
    useEffect(() => {
        if (!open) return;
        return () => aiRef.current.cancel();
    }, [open]);

    const busy = ai.phase !== 'idle';
    const trimmed = prompt.trim();
    const canSubmit = !busy && trimmed.length >= MIN_PROMPT;
    const usage = ai.usage;

    const regenerate = (item: AiHistoryItem) => {
        setPrompt(item.prompt);
        setDialect(item.dialect);
        setTab('new');
    };

    const counter = usage
        ? usage.kind === 'lifetime'
            ? `Осталось ${usage.remaining} из ${usage.limit} бесплатных генераций`
            : `Сегодня осталось ${usage.remaining} из ${usage.limit} генераций`
        : null;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (busy) return; // во время генерации закрыть можно только кнопкой «Отмена»
                onOpenChange(next);
            }}
        >
            <DialogContent
                className="flex max-h-dvh w-full flex-col gap-4 md:max-w-screen-sm"
                showClose={!busy}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="size-5 text-pink-600" />
                        Создать схему с ИИ
                    </DialogTitle>
                    <DialogDescription>
                        Опишите предметную область — получите готовую диаграмму
                        с таблицами, связями и индексами.
                    </DialogDescription>
                </DialogHeader>

                <div role="tablist" className="flex gap-2 border-b">
                    {(
                        [
                            ['new', 'Новая схема'],
                            ['history', 'Мои генерации'],
                        ] as const
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            role="tab"
                            type="button"
                            aria-selected={tab === key}
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

                {tab === 'history' ? (
                    <AiHistoryList
                        items={ai.history}
                        loaded={ai.historyLoaded}
                        disabled={busy}
                        onOpen={(id) => void ai.restore(id)}
                        onRegenerate={regenerate}
                        onDelete={(id) => void ai.remove(id)}
                    />
                ) : busy ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <Spinner className="text-pink-600" />
                        <p className="text-sm font-medium">
                            {ai.phase === 'generating'
                                ? `Проектирую… ${pluralTables(ai.tableCount)}`
                                : 'Собираю диаграмму…'}
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowSql((v) => !v)}
                            className="text-xs text-muted-foreground underline"
                        >
                            {showSql ? 'Скрыть SQL' : 'Показать SQL'}
                        </button>
                        {showSql ? (
                            <pre className="max-h-48 w-full overflow-auto rounded-lg bg-muted p-3 text-left font-mono text-xs">
                                {ai.ddl}
                            </pre>
                        ) : null}
                        {ai.phase === 'generating' ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={ai.cancel}
                            >
                                Отмена
                            </Button>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <AiPromptField
                            prompt={prompt}
                            onPromptChange={(value) => {
                                ai.clearError();
                                setPrompt(value.slice(0, AI_PROMPT_MAX));
                            }}
                            dialect={dialect}
                            onDialectChange={setDialect}
                        />

                        {ai.error === 'limit_free' ? (
                            <div className="rounded-xl border border-pink-600/40 bg-pink-600/5 p-4 text-sm">
                                <p className="font-semibold">
                                    Бесплатные генерации закончились
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    С ERD Pro — до 30 генераций в день и схемы
                                    до 20 таблиц. Прошлые варианты можно открыть
                                    во вкладке «Мои генерации» без ограничений.
                                </p>
                                <Button asChild className="mt-3">
                                    <Link to="/pricing">Открыть ERD Pro</Link>
                                </Button>
                            </div>
                        ) : ai.error === 'limit_daily' ? (
                            <p className="rounded-xl border p-4 text-sm">
                                Дневной лимит исчерпан — счётчик обнулится
                                завтра. Прошлые варианты можно открыть во
                                вкладке «Мои генерации».
                            </p>
                        ) : ai.error ? (
                            <p className="text-sm text-destructive">
                                {ERROR_TEXT[ai.error]}
                            </p>
                        ) : null}

                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                                {counter}
                            </span>
                            <Button
                                type="button"
                                disabled={!canSubmit}
                                onClick={() => onSubmit(trimmed, dialect)}
                            >
                                Сгенерировать
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
