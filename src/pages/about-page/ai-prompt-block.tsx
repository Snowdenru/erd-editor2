import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/button/button';
import { AiPromptField } from '@/components/ai-generate/ai-prompt-field';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { clearPending, savePending } from '@/lib/ai-generate/pending';
import type { AiDialect } from '@/lib/ai-generate/types';
import { appUrl } from '@/lib/app-config';
import { NEW_DIAGRAM_PATH } from '@/lib/erd-paths';
import { isLoggedIn } from '@/lib/sqllab-account';

const MIN_PROMPT = 3;

// На лендинге нет хоста генерации (нет провайдеров редактора): запрос сохраняем и
// передаём в редактор на /new, где хост подхватит его и сам запустит генерацию.
export const AiPromptBlock: React.FC = () => {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [dialect, setDialect] = useState<AiDialect>('postgresql');
    const [loginOpen, setLoginOpen] = useState(false);
    const trimmed = prompt.trim();

    const submit = () => {
        // Путь — с префиксом приложения: так его видит window.location в редакторе
        savePending({
            prompt: trimmed,
            dialect,
            path: appUrl(NEW_DIAGRAM_PATH),
        });
        if (isLoggedIn()) {
            navigate(NEW_DIAGRAM_PATH);
            return;
        }
        setLoginOpen(true);
    };

    return (
        <div className="mx-auto w-full max-w-3xl px-6 pb-16">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
                <h2 className="text-4xl font-bold sm:text-5xl">
                    Опишите базу — получите схему
                </h2>
                <p className="text-lg text-muted-foreground">
                    ИИ спроектирует таблицы, связи и индексы по вашему описанию.
                    Результат можно сразу править в редакторе.
                </p>
            </div>
            <AiPromptField
                prompt={prompt}
                onPromptChange={setPrompt}
                dialect={dialect}
                onDialectChange={setDialect}
                rows={3}
            />
            <Button
                type="button"
                size="lg"
                disabled={trimmed.length < MIN_PROMPT}
                onClick={submit}
                className="mt-4 h-12 w-full rounded-xl text-base"
            >
                <Sparkles className="mr-2 size-5" />
                Сгенерировать схему
            </Button>
            <LoginPromptDialog
                open={loginOpen}
                onOpenChange={(next) => {
                    // «Не сейчас»/закрытие: сохранённый запрос больше не нужен
                    if (!next) clearPending();
                    setLoginOpen(next);
                }}
                reason="ai_generate"
                returnPath={appUrl(NEW_DIAGRAM_PATH)}
            />
        </div>
    );
};
