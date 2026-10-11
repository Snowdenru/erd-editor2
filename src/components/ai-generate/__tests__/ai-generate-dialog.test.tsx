import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiGenerateDialog } from '../ai-generate-dialog';
import type { AiGenerateApi } from '../use-ai-generate';

const FREE_USAGE = {
    tier: 'free',
    kind: 'lifetime',
    limit: 3,
    used: 1,
    remaining: 2,
} as const;

const makeAi = (over: Partial<AiGenerateApi> = {}): AiGenerateApi => ({
    phase: 'idle',
    ddl: '',
    tableCount: 0,
    error: null,
    usage: FREE_USAGE,
    history: [],
    historyLoaded: true,
    historyFailed: false,
    generate: vi.fn(),
    cancel: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
    reload: vi.fn(),
    clearError: vi.fn(),
    ...over,
});

const renderDialog = (
    ai: AiGenerateApi,
    onSubmit = vi.fn(),
    initialPrompt = '',
    onOpenChange: (o: boolean) => void = () => undefined
) =>
    render(
        <MemoryRouter>
            <AiGenerateDialog
                open
                onOpenChange={onOpenChange}
                ai={ai}
                initialPrompt={initialPrompt}
                initialDialect="postgresql"
                onSubmit={onSubmit}
            />
        </MemoryRouter>
    );

describe('AiGenerateDialog idle', () => {
    it('shows the free-tier counter from the server usage', () => {
        renderDialog(makeAi());
        expect(screen.getByText(/осталось 2 из 3/i)).toBeInTheDocument();
    });

    it('shows a daily counter for paid tiers', () => {
        renderDialog(
            makeAi({
                usage: {
                    tier: 'erd',
                    kind: 'daily',
                    limit: 30,
                    used: 5,
                    remaining: 25,
                },
            })
        );
        expect(
            screen.getByText(/сегодня осталось 25 из 30/i)
        ).toBeInTheDocument();
    });

    it('fills the prompt from an example chip', () => {
        renderDialog(makeAi());
        fireEvent.click(screen.getByRole('button', { name: 'Школа' }));
        expect(
            (screen.getByRole('textbox') as HTMLTextAreaElement).value
        ).toMatch(/школа/i);
    });

    it('disables submit for a too-short prompt and submits prompt with the chosen dialect', () => {
        const onSubmit = vi.fn();
        renderDialog(makeAi(), onSubmit);
        const submit = screen.getByRole('button', { name: 'Сгенерировать' });
        expect(submit).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Интернет-магазин' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'MySQL' }));
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        expect(onSubmit).toHaveBeenCalledWith('Интернет-магазин', 'mysql');
    });
});

describe('AiGenerateDialog progress and errors', () => {
    it('shows progress with the table count and a cancel button while generating', () => {
        const ai = makeAi({ phase: 'generating', tableCount: 4 });
        renderDialog(ai);
        expect(screen.getByText(/проектирую… 4 таблицы/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(ai.cancel).toHaveBeenCalled();
    });

    it('reveals the raw SQL only on demand', () => {
        renderDialog(
            makeAi({
                phase: 'generating',
                tableCount: 1,
                ddl: 'CREATE TABLE a (id int);',
            })
        );
        expect(
            screen.queryByText('CREATE TABLE a (id int);')
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /показать sql/i }));
        expect(
            screen.getByText('CREATE TABLE a (id int);')
        ).toBeInTheDocument();
    });

    it('shows the free wall with a link to pricing', () => {
        renderDialog(
            makeAi({
                error: 'limit_free',
                usage: { ...FREE_USAGE, used: 3, remaining: 0 },
            })
        );
        expect(
            screen.getByText(/бесплатные генерации закончились/i)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /открыть erd pro/i })
        ).toHaveAttribute('href', '/pricing');
    });

    it('explains the daily ceiling and that history is still free to open', () => {
        renderDialog(makeAi({ error: 'limit_daily' }));
        expect(screen.getByText(/дневной лимит исчерпан/i)).toBeInTheDocument();
    });

    it.each([
        ['off_topic', /не похоже на описание базы данных/i],
        ['provider', /сервис генерации временно недоступен/i],
        ['parse', /не удалось собрать диаграмму/i],
        ['cooldown', /подождите/i],
        ['network', /не удалось связаться/i],
        ['auth', /нужно войти в аккаунт/i],
        ['invalid_prompt', /опишите базу подробнее/i],
    ] as const)('shows a message for %s', (error, pattern) => {
        renderDialog(makeAi({ error }));
        expect(screen.getByText(pattern)).toBeInTheDocument();
    });

    it('reminds that a failed attempt was not charged for off-topic and provider errors', () => {
        renderDialog(makeAi({ error: 'off_topic' }));
        expect(screen.getByText(/попытка не потрачена/i)).toBeInTheDocument();
    });
});

describe('AiGenerateDialog history', () => {
    const item = {
        id: 'g1',
        prompt: 'Школа: ученики и классы',
        dialect: 'mysql' as const,
        table_count: 3,
        diagram_id: null,
        tables: ['students', 'classes', 'grades'],
        created_at: '2026-10-03T10:00:00Z',
    };

    it('lists saved generations and restores one without spending an attempt', () => {
        const ai = makeAi({ history: [item] });
        renderDialog(ai);
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(screen.getByText('Школа: ученики и классы')).toBeInTheDocument();
        expect(screen.getByText('students')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));
        expect(ai.restore).toHaveBeenCalledWith('g1');
    });

    it('regenerates with the saved prompt through the normal submit path', () => {
        const onSubmit = vi.fn();
        renderDialog(makeAi({ history: [item] }), onSubmit);
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Сгенерировать заново' })
        );
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
            'Школа: ученики и классы'
        );
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('deletes an item from the list', () => {
        const ai = makeAi({ history: [item] });
        renderDialog(ai);
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Удалить из списка' })
        );
        expect(ai.remove).toHaveBeenCalledWith('g1');
    });

    it('shows an empty-history hint', () => {
        renderDialog(makeAi());
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(
            screen.getByText(/здесь появятся ваши генерации/i)
        ).toBeInTheDocument();
    });
});

describe('AiGenerateDialog lifecycle', () => {
    it('cancels the running generation when the dialog closes', () => {
        const ai = makeAi({ phase: 'generating', tableCount: 1 });
        const { rerender } = renderDialog(ai);
        expect(ai.cancel).not.toHaveBeenCalled();
        rerender(
            <MemoryRouter>
                <AiGenerateDialog
                    open={false}
                    onOpenChange={() => undefined}
                    ai={ai}
                    initialPrompt=""
                    initialDialect="postgresql"
                    onSubmit={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(ai.cancel).toHaveBeenCalled();
    });

    it('cancels on unmount', () => {
        const ai = makeAi();
        renderDialog(ai).unmount();
        expect(ai.cancel).toHaveBeenCalled();
    });

    it('shows a message when saving the diagram failed', () => {
        renderDialog(makeAi({ error: 'save' }));
        expect(
            screen.getByText(/не удалось сохранить схему/i)
        ).toBeInTheDocument();
    });
});

describe('AiGenerateDialog review fixes', () => {
    const item = {
        id: 'g1',
        prompt: 'Школа',
        dialect: 'mysql' as const,
        table_count: 3,
        diagram_id: null,
        tables: ['students'],
        created_at: '2026-10-03T10:00:00Z',
    };

    it('shows a restore error in the history tab too', () => {
        renderDialog(makeAi({ history: [item], error: 'save' }));
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(screen.getByRole('alert')).toHaveTextContent(
            /не удалось сохранить схему/i
        );
        expect(
            screen.queryByText(/попытка возвращена/i)
        ).not.toBeInTheDocument();
    });

    it('allows closing with Escape while importing, blocks it while generating', () => {
        const onOpenChange = vi.fn();
        const { unmount } = renderDialog(
            makeAi({ phase: 'importing' }),
            vi.fn(),
            '',
            onOpenChange
        );
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: 'Escape',
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        unmount();

        const blocked = vi.fn();
        renderDialog(
            makeAi({ phase: 'generating', tableCount: 1 }),
            vi.fn(),
            '',
            blocked
        );
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: 'Escape',
        });
        expect(blocked).not.toHaveBeenCalled();
    });

    it('shows loading and failure states in history', () => {
        const { unmount } = renderDialog(makeAi({ historyLoaded: false }));
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(screen.getByText(/загружаю/i)).toBeInTheDocument();
        unmount();
        renderDialog(makeAi({ historyFailed: true }));
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(
            screen.getByText(/не удалось загрузить список/i)
        ).toBeInTheDocument();
        expect(screen.queryByText(/здесь появятся/i)).not.toBeInTheDocument();
    });

    it('disables delete while busy and clears the error on open', () => {
        const ai = makeAi({ history: [item], phase: 'importing' });
        renderDialog(ai);
        expect(ai.clearError).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('tab', { name: /мои генерации/i }));
        expect(
            screen.getByRole('button', { name: 'Удалить из списка' })
        ).toBeDisabled();
    });
});
