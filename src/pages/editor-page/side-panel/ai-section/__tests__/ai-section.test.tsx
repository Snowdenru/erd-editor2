import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diffDiagrams } from '@/lib/ai-generate/diagram-diff';
import { diagram, field, table } from '@/lib/ai-generate/__tests__/fixtures';
import type { AiRefineApi } from '@/components/ai-generate/use-ai-refine';

const api = vi.hoisted(() => ({ current: null as unknown as AiRefineApi }));
const emitOpenAiGenerate = vi.hoisted(() => vi.fn());

vi.mock('@/components/ai-generate/use-ai-refine', () => ({
    useAiRefine: () => api.current,
}));
vi.mock('@/lib/ai-generate/events', async () => {
    const actual = await vi.importActual('@/lib/ai-generate/events');
    return { ...actual, emitOpenAiGenerate };
});
vi.mock('@/components/auth-blur-gate/auth-blur-gate', () => ({
    AuthBlurGate: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));
const fitView = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({
    useReactFlow: () => ({ fitView }),
}));

import { AiSection } from '../ai-section';

const baseApi = (extra: Partial<AiRefineApi> = {}): AiRefineApi => ({
    phase: 'idle',
    error: null,
    usage: { tier: 'free', kind: 'lifetime', limit: 3, used: 1, remaining: 2 },
    proposal: null,
    noChanges: false,
    canUndo: false,
    run: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    clearError: vi.fn(),
    ...extra,
});

beforeEach(() => {
    vi.clearAllMocks();
    api.current = baseApi();
});

describe('AiSection', () => {
    it('shows three tabs and opens the generation dialog from «Создать»', () => {
        render(<AiSection />);
        expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
            'Создать',
            'Улучшить',
            'Доработать',
        ]);
        fireEvent.change(screen.getByLabelText('Описание новой схемы'), {
            target: { value: 'школа с классами' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Описать схему' }));
        expect(emitOpenAiGenerate).toHaveBeenCalledWith({
            source: 'sidebar',
            prompt: 'школа с классами',
        });
    });

    it('runs a review from «Улучшить»', () => {
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Проверить схему' })
        );
        expect(api.current.run).toHaveBeenCalledWith('review');
        expect(screen.getByText(/Осталось 2 из 3/)).toBeTruthy();
    });

    it('«Доработать» needs an instruction and sends it', () => {
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Доработать' }));
        const button = screen.getByRole('button', { name: 'Доработать схему' });
        expect(button).toHaveProperty('disabled', true);
        fireEvent.change(screen.getByLabelText('Инструкция'), {
            target: { value: 'добавь таблицу отзывов' },
        });
        expect(button).toHaveProperty('disabled', false);
        fireEvent.click(button);
        expect(api.current.run).toHaveBeenCalledWith(
            'edit',
            'добавь таблицу отзывов'
        );
    });

    it('shows progress with a cancel button while running', () => {
        api.current = baseApi({ phase: 'running' });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(screen.getByText(/Работаю над схемой/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(api.current.cancel).toHaveBeenCalled();
    });

    it('shows changes and diff with apply and discard buttons', () => {
        const before = diagram([table('users', [field('id')])]);
        const after = diagram([
            table('users', [field('id'), field('email')]),
            table('reviews', [field('id')]),
        ]);
        api.current = baseApi({
            phase: 'review',
            proposal: {
                mode: 'review',
                generationId: 'g1',
                diagramId: 'd1',
                changes: ['добавлен email'],
                diff: diffDiagrams(before, after),
                proposed: after,
            },
        });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(screen.getByText('добавлен email')).toBeTruthy();
        expect(screen.getByText(/reviews/)).toBeTruthy();
        expect(screen.getByText(/email/, { selector: 'li li' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Применить всё' }));
        expect(api.current.apply).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(api.current.discard).toHaveBeenCalled();
    });

    it('shows the limit wall with a link to pricing', () => {
        api.current = baseApi({ error: 'limit_free' });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(screen.getByText(/Бесплатные попытки закончились/)).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Открыть ERD Pro' })
                .getAttribute('href')
        ).toBe('/tools/erd/pricing');
    });

    it('shows «Схема уже в порядке» and the undo button after applying', () => {
        api.current = baseApi({ noChanges: true, canUndo: true });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(screen.getByText(/Схема уже в порядке/)).toBeTruthy();
        fireEvent.click(
            screen.getByRole('button', { name: 'Отменить применение' })
        );
        expect(api.current.undo).toHaveBeenCalled();
    });

    const reviewProposal = (): AiRefineApi['proposal'] => {
        const before = diagram([table('users', [field('id')])]);
        const after = diagram([table('users', [field('id'), field('x')])]);
        return {
            mode: 'review',
            generationId: 'g1',
            diagramId: 'd1',
            changes: ['добавлен x'],
            diff: diffDiagrams(before, after),
            proposed: after,
        };
    };

    it('shows a proposal made on «Улучшить» also on «Доработать»', () => {
        api.current = baseApi({ phase: 'review', proposal: reviewProposal() });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Доработать' }));
        expect(
            screen.getByRole('button', { name: 'Применить всё' })
        ).toBeTruthy();
    });

    it('shows a notice on «Создать» while a proposal is pending', () => {
        api.current = baseApi({ phase: 'review', proposal: reviewProposal() });
        render(<AiSection />);
        expect(
            screen.getByText(/Есть неприменённое предложение ИИ/)
        ).toBeTruthy();
    });

    it('shows the daily wall and the daily counter', () => {
        api.current = baseApi({
            error: 'limit_daily',
            usage: {
                tier: 'pro',
                kind: 'daily',
                limit: 30,
                used: 30,
                remaining: 0,
            },
        });
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(
            screen.getByText(/Дневной лимит ИИ-запросов исчерпан/)
        ).toBeTruthy();
        expect(
            screen.getByText('Осталось 0 из 30 запросов на сегодня')
        ).toBeTruthy();
    });

    it('clears a stale error when switching tabs', () => {
        render(<AiSection />);
        fireEvent.click(screen.getByRole('tab', { name: 'Улучшить' }));
        expect(api.current.clearError).toHaveBeenCalled();
    });

    it('fits the view when canUndo flips to true after apply', () => {
        vi.useFakeTimers();
        try {
            api.current = baseApi({ canUndo: false });
            const { rerender } = render(<AiSection />);
            vi.advanceTimersByTime(1000);
            expect(fitView).not.toHaveBeenCalled();
            api.current = baseApi({ canUndo: true });
            rerender(<AiSection />);
            vi.advanceTimersByTime(1000);
            expect(fitView).toHaveBeenCalledWith({
                padding: 0.15,
                duration: 200,
                maxZoom: 1,
            });
        } finally {
            vi.useRealTimers();
        }
    });
});
