import React, { useState } from 'react';
import { Button } from '@/components/button/button';
import type {
    AiRefineApi,
    RefineUiError,
} from '@/components/ai-generate/use-ai-refine';
import type { AiRefineMode } from '@/lib/ai-generate/types';
import { AiRefineResult } from './ai-refine-result';

const ERROR_TEXT: Record<RefineUiError, string> = {
    invalid_prompt: 'Проверьте инструкцию: от 3 до 1000 символов.',
    cooldown: 'Подождите несколько секунд перед следующим запросом.',
    limit_free: 'Бесплатные попытки закончились.',
    limit_daily: 'Дневной лимит ИИ-запросов исчерпан, попробуйте завтра.',
    auth: 'Войдите в аккаунт, чтобы пользоваться ИИ.',
    network: 'Не удалось связаться с сервером. Попробуйте ещё раз.',
    too_large:
        'Схема слишком большая для проверки. Уберите лишние таблицы и повторите.',
    empty_diagram: 'Сначала добавьте таблицы или создайте схему с ИИ.',
    provider: 'ИИ не ответил. Попытка не потрачена, повторите запрос.',
    parse: 'ИИ вернул схему, которую не удалось разобрать. Попытка возвращена.',
    apply: 'Не удалось применить изменения. Схема осталась прежней, попытка возвращена.',
};

export interface AiRefinePanelProps {
    mode: AiRefineMode;
    ai: AiRefineApi;
}

export const AiRefinePanel: React.FC<AiRefinePanelProps> = ({ mode, ai }) => {
    const [instruction, setInstruction] = useState('');
    const running = ai.phase === 'running';
    const busy = running || ai.phase === 'applying';
    const proposal = ai.proposal;
    const wall = ai.error === 'limit_free' || ai.error === 'limit_daily';

    return (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            {mode === 'edit' ? (
                <>
                    <label
                        className="text-sm font-medium"
                        htmlFor="ai-edit-instruction"
                    >
                        Инструкция
                    </label>
                    <textarea
                        id="ai-edit-instruction"
                        aria-label="Инструкция"
                        value={instruction}
                        maxLength={1000}
                        rows={3}
                        disabled={busy}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Например: добавь таблицу отзывов о товарах"
                        className="w-full resize-none rounded-md border bg-background p-2 text-sm"
                    />
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    ИИ проверит схему: ключи, индексы, типы данных, ограничения
                    и нейминг, и покажет, что можно улучшить. Вы увидите
                    изменения до применения.
                </p>
            )}

            {!proposal ? (
                <div className="flex items-center gap-2">
                    {running ? (
                        <>
                            <p className="text-sm">Работаю над схемой…</p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={ai.cancel}
                            >
                                Отмена
                            </Button>
                        </>
                    ) : mode === 'edit' ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || instruction.trim().length < 3}
                            onClick={() =>
                                void ai.run('edit', instruction.trim())
                            }
                        >
                            Доработать схему
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void ai.run('review')}
                        >
                            Проверить схему
                        </Button>
                    )}
                </div>
            ) : null}

            {ai.usage ? (
                <p className="text-xs text-muted-foreground">
                    {ai.usage.kind === 'lifetime'
                        ? `Осталось ${ai.usage.remaining} из ${ai.usage.limit} бесплатных запросов`
                        : `Осталось ${ai.usage.remaining} из ${ai.usage.limit} запросов на сегодня`}
                </p>
            ) : null}

            {ai.error ? (
                <div
                    role="alert"
                    className="rounded-md border border-destructive/40 p-2 text-sm text-destructive"
                >
                    {ERROR_TEXT[ai.error]}
                    {wall ? (
                        <>
                            {' '}
                            С ERD Pro — до 30 запросов в день.{' '}
                            <a
                                className="font-medium underline"
                                href="/tools/erd/pricing"
                            >
                                Открыть ERD Pro
                            </a>
                        </>
                    ) : null}
                </div>
            ) : null}

            {ai.noChanges && !proposal ? (
                <p className="rounded-md border p-2 text-sm">
                    Схема уже в порядке — предложений нет.
                </p>
            ) : null}

            {ai.canUndo && !proposal ? (
                <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <span>Изменения применены.</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void ai.undo()}
                    >
                        Отменить применение
                    </Button>
                </div>
            ) : null}

            {proposal ? (
                <AiRefineResult
                    proposal={proposal}
                    busy={busy}
                    onApply={() => void ai.apply()}
                    onDiscard={() => void ai.discard()}
                />
            ) : null}
        </div>
    );
};
