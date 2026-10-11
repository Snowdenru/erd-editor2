import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { onOpenAiGenerate } from '@/lib/ai-generate/events';
import { consumePending, savePending } from '@/lib/ai-generate/pending';
import type { AiDialect } from '@/lib/ai-generate/types';
import { isLoggedIn, trackEvent } from '@/lib/sqllab-account';
import { AiGenerateDialog } from './ai-generate-dialog';
import { useAiGenerate } from './use-ai-generate';

const MIN_PROMPT = 3;
const page = () => window.location.pathname;

interface Seed {
    prompt: string;
    dialect: AiDialect;
}

export const AiGenerateHost: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [seed, setSeed] = useState<Seed>({
        prompt: '',
        dialect: 'postgresql',
    });
    const ai = useAiGenerate({ onDone: () => setOpen(false) });
    const { generate, reload, error, clearError } = ai;
    // Последний отправленный запрос: нужен, если сервер ответил «не авторизован».
    const lastRef = useRef<Seed | null>(null);

    const start = useCallback(
        (prompt: string, dialect: AiDialect) => {
            lastRef.current = { prompt, dialect };
            void generate(prompt, dialect);
        },
        [generate]
    );

    // Единая точка проверки входа: без входа запоминаем запрос и ведём на логин.
    const request = useCallback(
        (prompt: string, dialect: AiDialect) => {
            if (!isLoggedIn()) {
                savePending({ prompt, dialect });
                setLoginOpen(true);
                return;
            }
            start(prompt, dialect);
        },
        [start]
    );

    // Диалог сам историю не грузит: делаем это при каждом открытии.
    const openWith = useCallback(
        (next: Seed) => {
            setSeed(next);
            setOpen(true);
            if (isLoggedIn()) {
                void reload();
            }
        },
        [reload]
    );

    useEffect(
        () =>
            onOpenAiGenerate((detail) => {
                const next: Seed = {
                    prompt: detail.prompt ?? '',
                    dialect: detail.dialect ?? 'postgresql',
                };
                trackEvent('erd2_ai_open', page(), { source: detail.source });
                const canStart =
                    detail.autostart && next.prompt.trim().length >= MIN_PROMPT;
                if (canStart && !isLoggedIn()) {
                    savePending({ prompt: next.prompt, dialect: next.dialect });
                    setLoginOpen(true);
                    return;
                }
                openWith(next);
                if (canStart) {
                    start(next.prompt, next.dialect);
                }
            }),
        [start, openWith]
    );

    // Возврат с входа: запрос, сохранённый до логина, запускаем сам.
    useEffect(() => {
        if (!isLoggedIn()) return;
        const pending = consumePending();
        if (!pending) return;
        trackEvent('erd2_ai_open', page(), { source: 'resume' });
        openWith({ prompt: pending.prompt, dialect: pending.dialect });
        start(pending.prompt, pending.dialect);
    }, [start, openWith]);

    // Токен есть, но сервер ответил 401/403 (сессия истекла): тот же путь через вход.
    useEffect(() => {
        if (error !== 'auth') return;
        if (lastRef.current) {
            savePending(lastRef.current);
        }
        clearError();
        setLoginOpen(true);
    }, [error, clearError]);

    return (
        <>
            <AiGenerateDialog
                open={open}
                onOpenChange={setOpen}
                ai={ai}
                initialPrompt={seed.prompt}
                initialDialect={seed.dialect}
                onSubmit={request}
            />
            <LoginPromptDialog
                open={loginOpen}
                onOpenChange={setLoginOpen}
                reason="ai_generate"
            />
        </>
    );
};
