import { currentPage } from '@/lib/ai-generate/format';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { onOpenAiGenerate } from '@/lib/ai-generate/events';
import {
    clearPending,
    consumePending,
    savePending,
} from '@/lib/ai-generate/pending';
import type { AiDialect } from '@/lib/ai-generate/types';
import { isLoggedIn, trackEvent } from '@/lib/sqllab-account';
import { AiGenerateDialog } from './ai-generate-dialog';
import { useAiGenerate } from './use-ai-generate';

const MIN_PROMPT = 3;

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
    const lastRef = useRef<(Seed & { resumed: boolean }) | null>(null);

    const start = useCallback(
        (prompt: string, dialect: AiDialect, resumed = false) => {
            lastRef.current = { prompt, dialect, resumed };
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
                trackEvent('erd2_ai_open', currentPage(), {
                    source: detail.source,
                });
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
        trackEvent('erd2_ai_open', currentPage(), { source: 'resume' });
        openWith({ prompt: pending.prompt, dialect: pending.dialect });
        start(pending.prompt, pending.dialect, true);
    }, [start, openWith]);

    // Токен есть, но сервер ответил 401/403 (сессия истекла): тот же путь через вход.
    useEffect(() => {
        if (error !== 'auth') return;
        const last = lastRef.current;
        // Запрос уже возобновлялся после входа и снова получил отказ: не зацикливаем
        // вход, показываем сообщение об ошибке в диалоге.
        if (last?.resumed) return;
        if (last) {
            savePending({ prompt: last.prompt, dialect: last.dialect });
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
                onOpenChange={(next) => {
                    // «Не сейчас» / закрытие: сохранённый запрос больше не нужен.
                    // Кнопка «Войти» диалог не закрывает, так что запрос доживёт до входа.
                    if (!next) clearPending();
                    setLoginOpen(next);
                }}
                reason="ai_generate"
            />
        </>
    );
};
