import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiGenerateHost } from '../ai-generate-host';
import { emitOpenAiGenerate } from '@/lib/ai-generate/events';
import { consumePending, savePending } from '@/lib/ai-generate/pending';

const m = vi.hoisted(() => ({
    isLoggedIn: vi.fn(),
    trackEvent: vi.fn(),
    generate: vi.fn(),
    reload: vi.fn(),
    error: null as string | null,
    clearError: vi.fn(),
}));

vi.mock('@/lib/sqllab-account', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    isLoggedIn: m.isLoggedIn,
    trackEvent: m.trackEvent,
}));
vi.mock('../use-ai-generate', () => ({
    useAiGenerate: () => ({
        phase: 'idle',
        ddl: '',
        tableCount: 0,
        error: m.error,
        historyFailed: false,
        usage: null,
        history: [],
        historyLoaded: true,
        generate: m.generate,
        cancel: vi.fn(),
        restore: vi.fn(),
        remove: vi.fn(),
        reload: m.reload,
        clearError: m.clearError,
    }),
}));

const renderHost = () =>
    render(
        <MemoryRouter>
            <AiGenerateHost />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    m.error = null;
    m.isLoggedIn.mockReturnValue(true);
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, pathname: '/tools/erd/', assign: vi.fn() },
    });
});

describe('AiGenerateHost', () => {
    it('opens the dialog on an event, tracks it and loads history', () => {
        renderHost();
        act(() => emitOpenAiGenerate({ source: 'empty_state' }));
        expect(screen.getByText('Создать схему с ИИ')).toBeInTheDocument();
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_open',
            '/tools/erd/',
            { source: 'empty_state' }
        );
        expect(m.reload).toHaveBeenCalled();
        expect(m.generate).not.toHaveBeenCalled();
    });

    it('autostarts generation for a logged-in user', () => {
        renderHost();
        act(() =>
            emitOpenAiGenerate({
                source: 'landing',
                prompt: 'Школа и ученики',
                dialect: 'mysql',
                autostart: true,
            })
        );
        expect(m.generate).toHaveBeenCalledWith('Школа и ученики', 'mysql');
        expect(screen.getByText('Создать схему с ИИ')).toBeInTheDocument();
    });

    it('for a logged-out user saves the prompt and asks to log in instead of generating', () => {
        m.isLoggedIn.mockReturnValue(false);
        renderHost();
        act(() =>
            emitOpenAiGenerate({
                source: 'landing',
                prompt: 'Школа и ученики',
                dialect: 'mysql',
                autostart: true,
            })
        );
        expect(m.generate).not.toHaveBeenCalled();
        expect(
            screen.getByText(/войдите, чтобы сгенерировать схему/i)
        ).toBeInTheDocument();
        expect(consumePending()).toMatchObject({
            prompt: 'Школа и ученики',
            dialect: 'mysql',
        });
    });

    it('resumes a pending prompt after login on the same page', () => {
        savePending({ prompt: 'Клиника и пациенты', dialect: 'postgresql' });
        renderHost();
        expect(m.generate).toHaveBeenCalledWith(
            'Клиника и пациенты',
            'postgresql'
        );
        expect(m.trackEvent).toHaveBeenCalledWith(
            'erd2_ai_open',
            '/tools/erd/',
            { source: 'resume' }
        );
        expect(consumePending()).toBeNull();
    });

    it('does not resume when the user is still logged out', () => {
        m.isLoggedIn.mockReturnValue(false);
        savePending({ prompt: 'Клиника и пациенты', dialect: 'postgresql' });
        renderHost();
        expect(m.generate).not.toHaveBeenCalled();
    });

    it('submit from the dialog goes through the login gate too', () => {
        m.isLoggedIn.mockReturnValue(false);
        renderHost();
        // Открытие без autostart входа не требует — вход проверяется при отправке
        act(() => emitOpenAiGenerate({ source: 'create_dialog' }));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Интернет-магазин' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать' }));
        expect(m.generate).not.toHaveBeenCalled();
        expect(
            screen.getByText(/войдите, чтобы сгенерировать схему/i)
        ).toBeInTheDocument();
        expect(consumePending()).toMatchObject({ prompt: 'Интернет-магазин' });
    });

    it('submit from the dialog generates for a logged-in user', () => {
        renderHost();
        act(() =>
            emitOpenAiGenerate({ source: 'create_dialog', dialect: 'sqlite' })
        );
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Интернет-магазин' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать' }));
        expect(m.generate).toHaveBeenCalledWith('Интернет-магазин', 'sqlite');
    });

    it('an auth error from the server asks to log in and keeps the prompt', () => {
        const view = renderHost();
        act(() => emitOpenAiGenerate({ source: 'create_dialog' }));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Интернет-магазин' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать' }));
        expect(m.generate).toHaveBeenCalledWith(
            'Интернет-магазин',
            'postgresql'
        );
        m.error = 'auth';
        view.rerender(
            <MemoryRouter>
                <AiGenerateHost />
            </MemoryRouter>
        );
        expect(
            screen.getByText(/войдите, чтобы сгенерировать схему/i)
        ).toBeInTheDocument();
        expect(consumePending()).toMatchObject({ prompt: 'Интернет-магазин' });
        expect(m.clearError).toHaveBeenCalled();
    });
});
