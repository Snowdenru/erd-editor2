import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockIsLoggedIn = vi.fn();

vi.mock('@/lib/sqllab-account', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    isLoggedIn: () => mockIsLoggedIn(),
    trackEvent: vi.fn(),
}));

import { AiPromptBlock } from '../ai-prompt-block';
import { consumePending } from '@/lib/ai-generate/pending';
import * as events from '@/lib/ai-generate/events';

const renderBlock = () =>
    render(
        <MemoryRouter basename="/tools/erd2" initialEntries={['/tools/erd2/']}>
            <Routes>
                <Route path="/" element={<AiPromptBlock />} />
                <Route path="/new" element={<div>EDITOR</div>} />
            </Routes>
        </MemoryRouter>
    );

const assign = vi.fn();

beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockIsLoggedIn.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, pathname: '/tools/erd2/', assign },
    });
});

const fill = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Клиника' }));
    fireEvent.click(screen.getByRole('button', { name: 'MySQL' }));
    fireEvent.click(
        screen.getByRole('button', { name: /сгенерировать схему/i })
    );
};

describe('AiPromptBlock', () => {
    it('keeps the button disabled until the prompt is long enough', () => {
        renderBlock();
        const button = screen.getByRole('button', {
            name: /сгенерировать схему/i,
        });
        expect(button).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'Школа и ученики' },
        });
        expect(button).toBeEnabled();
    });

    it('logged out: saves the request for the editor route and offers login', () => {
        mockIsLoggedIn.mockReturnValue(false);
        const emit = vi.spyOn(events, 'emitOpenAiGenerate');
        renderBlock();
        fill();

        expect(emit).not.toHaveBeenCalled();
        expect(
            screen.getByText('Войдите, чтобы сгенерировать схему')
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: /войти и сгенерировать/i })
        );
        expect(assign).toHaveBeenCalledWith(
            `/auth/login?returnUrl=${encodeURIComponent('/tools/erd2/new')}`
        );

        // Редактор на /tools/erd2/new подхватывает запрос
        window.location.pathname = '/tools/erd2/new';
        mockIsLoggedIn.mockReturnValue(true);
        expect(consumePending()).toMatchObject({
            prompt: expect.stringMatching(/клиника/i),
            dialect: 'mysql',
            path: '/tools/erd2/new',
        });
    });

    it('declining the login prompt discards the saved request', () => {
        mockIsLoggedIn.mockReturnValue(false);
        renderBlock();
        fill();
        fireEvent.click(screen.getByRole('button', { name: 'Не сейчас' }));
        window.location.pathname = '/tools/erd2/new';
        expect(consumePending()).toBeNull();
    });

    it('logged in: saves the request and opens the editor without login', () => {
        mockIsLoggedIn.mockReturnValue(true);
        renderBlock();
        fill();
        expect(screen.getByText('EDITOR')).toBeInTheDocument();
        expect(assign).not.toHaveBeenCalled();
        window.location.pathname = '/tools/erd2/new';
        expect(consumePending()).toMatchObject({ dialect: 'mysql' });
    });
});
