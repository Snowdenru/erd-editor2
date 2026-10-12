import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/button/button';
import type {
    AiRefineApi,
    RefineUiError,
    RefundState,
} from '@/components/ai-generate/use-ai-refine';
import type { AiRefineMode } from '@/lib/ai-generate/types';
import { AiRefineResult } from './ai-refine-result';

const REFUNDED = 'Попытка возвращена.';
const DENIED = 'Попытка списана: лимит возвратов на сегодня исчерпан.';
const UNKNOWN =
    'Не удалось подтвердить возврат попытки — проверьте остаток запросов.';
const REFUND_TEXT: Record<RefundState, string> = {
    refunded: REFUNDED,
    denied: DENIED,
    unknown: UNKNOWN,
};

const ERROR_TEXT: Record<RefineUiError, string> = {
    invalid_prompt: 'Проверьте инструкцию: от 3 до 1000 символов.',
    cooldown: 'Подождите несколько секунд перед следующим запросом.',
    limit_free: 'Бесплатные попытки закончились.',
    limit_daily: 'Дневной лимит ИИ-запросов исчерпан, попробуйте завтра.',
    auth: 'Войдите в аккаунт, чтобы пользоваться ИИ.',
    network: 'Не удалось связаться с сервером. Попробуйте ещё раз.',
    too_large:
        'Схема слишком большая для проверки (примерно до 12 тыс. символов DDL). Уберите лишние таблицы и повторите.',
    too_many_tables:
        'В схеме больше таблиц, чем доступно на вашем тарифе для проверки ИИ.',
    unsupported_dialect:
        'ИИ-проверка работает со схемами PostgreSQL, MySQL, MariaDB, SQL Server и SQLite. Для этого диалекта она пока недоступна.',
    empty_diagram: 'Сначала добавьте таблицы или создайте схему с ИИ.',
    provider: 'ИИ не ответил. Попытка не потрачена, повторите запрос.',
    parse: 'ИИ вернул схему, которую не удалось разобрать.',
    apply: 'Не удалось применить изменения. Схема осталась прежней.',
    incomplete:
        'ИИ вернул неполную схему (часть таблиц пропала). Повторите запрос.',
};

const REFUND_ERRORS: ReadonlySet<RefineUiError> = new Set([
    'parse',
    'apply',
    'incomplete',
]);

const errorText = (
    error: RefineUiError,
    refundState: RefundState,
    limit: number | null
): string => {
    const base =
        error === 'too_many_tables' && limit != null
            ? `В схеме больше ${limit} таблиц — это максимум для проверки ИИ на вашем тарифе.`
            : ERROR_TEXT[error];
    return REFUND_ERRORS.has(error)
        ? `${base} ${REFUND_TEXT[refundState]}`
        : base;
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
    const wall =
        ai.error === 'limit_free' ||
        ai.error === 'limit_daily' ||
        ai.error === 'too_many_tables';
    const [confirmUndo, setConfirmUndo] = useState(false);
    const undo = async (force: boolean) => {
        const result = await ai.undo(force);
        setConfirmUndo(result === 'needs_confirm');
    };

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
                    {errorText(ai.error, ai.refundState, ai.errorLimit)}
                    {wall ? (
                        <>
                            {' '}
                            {ai.error === 'too_many_tables'
                                ? 'С ERD Pro ограничения мягче.'
                                : 'С ERD Pro — до 30 запросов в день.'}{' '}
                            <Link
                                className="font-medium underline"
                                to="/pricing"
                            >
                                Открыть ERD Pro
                            </Link>
                        </>
                    ) : null}
                </div>
            ) : null}

            {ai.noChanges && !proposal ? (
                <p className="rounded-md border p-2 text-sm">
                    Схема уже в порядке — предложений нет.
                </p>
            ) : null}

            {ai.canUndo && !proposal && ai.phase === 'idle' ? (
                <div className="flex flex-col gap-2 rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2">
                        <span>Изменения применены.</span>
                        {!confirmUndo ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void undo(false)}
                            >
                                Отменить применение
                            </Button>
                        ) : null}
                    </div>
                    {confirmUndo ? (
                        <>
                            <p role="alert">
                                После применения вы меняли схему. Отмена вернёт
                                её к состоянию до ИИ, и эти правки пропадут.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void undo(true)}
                                >
                                    Всё равно отменить
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmUndo(false)}
                                >
                                    Оставить как есть
                                </Button>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}

            {ai.notice === 'schema_changed' && proposal ? (
                <p role="status" className="rounded-md border p-2 text-sm">
                    Схема изменилась, пока вы смотрели предложение — проверьте
                    обновлённые изменения и примените ещё раз.
                </p>
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
