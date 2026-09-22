import React, { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useChartDB } from '@/hooks/use-chartdb';
import { buildLoginUrl, isLoggedIn, trackEvent } from '@/lib/sqllab-account';

const DISMISS_KEY = 'erd2_save_prompt_dismissed_at';
const DISMISS_DAYS = 7;
const SHOW_AFTER_TABLES = 3;
const SHOW_AFTER_MS = 120_000;

const wasRecentlyDismissed = (): boolean => {
    try {
        const at = Number(localStorage.getItem(DISMISS_KEY));
        return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
        return false;
    }
};

// Мягкое приглашение: схема лежит только в браузере, вход сохранит её в облаке
export const SaveToCloudPrompt: React.FC = () => {
    const { currentDiagram } = useChartDB();
    const tableCount = currentDiagram?.tables?.length ?? 0;
    const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
    const [timeElapsed, setTimeElapsed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setTimeElapsed(true), SHOW_AFTER_MS);
        return () => clearTimeout(timer);
    }, []);

    const visible =
        !dismissed &&
        !isLoggedIn() &&
        (tableCount >= SHOW_AFTER_TABLES || (timeElapsed && tableCount >= 1));

    useEffect(() => {
        if (visible) {
            trackEvent('erd2_login_prompt', window.location.pathname, {
                reason: 'save_editor',
            });
        }
    }, [visible]);

    if (!visible) {
        return null;
    }

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            // localStorage может быть недоступен — прячем только на эту сессию
        }
        setDismissed(true);
    };

    const goToLogin = () => {
        window.location.assign(
            buildLoginUrl(
                `${window.location.pathname}${window.location.search}`
            )
        );
    };

    return (
        <div className="fixed bottom-14 left-4 z-20 flex max-w-xs flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg">
            <div className="flex items-start gap-3">
                <Cloud className="mt-0.5 size-5 shrink-0 text-pink-600" />
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">
                        Сохраните схему в облаке
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Сейчас она хранится только в этом браузере. Войдите
                        через Яндекс, VK или почту — схема будет доступна с
                        любого устройства.
                    </p>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={dismiss}>
                    Позже
                </Button>
                <Button size="sm" onClick={goToLogin}>
                    Войти
                </Button>
            </div>
        </div>
    );
};
