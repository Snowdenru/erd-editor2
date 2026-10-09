import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { APP_BASE, appUrl } from '@/lib/app-config';
import { PRICING_PATH } from '@/lib/erd-paths';
import {
    embedCode,
    getShareState,
    publicLink,
    PUBLIC_THEMES,
    THEME_LABELS,
    updateShare,
    type PublicTheme,
    type ShareState,
} from '@/lib/public-share';
import { trackEvent } from '@/lib/sqllab-account';

export interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diagramId: string;
    retryDelayMs?: number;
}

// Облачная копия появляется после фонового автосохранения: при 404 несколько раз переспрашиваем.
const DEFAULT_RETRY_MS = 2000;
const RETRIES = 5;

export const ShareDialog: React.FC<ShareDialogProps> = ({
    open,
    onOpenChange,
    diagramId,
    retryDelayMs = DEFAULT_RETRY_MS,
}) => {
    const [state, setState] = useState<ShareState | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
        },
        []
    );

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        const load = async () => {
            for (let attempt = 0; attempt <= RETRIES; attempt++) {
                const result = await getShareState(diagramId);
                if (cancelled) return;
                if (result) {
                    setState(result);
                    setLoading(false);
                    return;
                }
                await new Promise((resolve) =>
                    setTimeout(resolve, retryDelayMs)
                );
            }
            if (!cancelled) {
                setState(null);
                setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [open, diagramId, retryDelayMs]);

    const wallShown =
        open && !loading && state && !state.can_share && !state.is_public;
    useEffect(() => {
        if (wallShown) {
            trackEvent('erd2_share_wall_view', window.location.pathname, {});
        }
    }, [wallShown]);

    const apply = useCallback(
        async (patch: { is_public?: boolean; public_theme?: PublicTheme }) => {
            setBusy(true);
            setError(null);
            const result = await updateShare(diagramId, patch);
            setBusy(false);
            if (result.ok) {
                setState(result.state);
                if (patch.is_public !== undefined) {
                    trackEvent(
                        patch.is_public
                            ? 'erd2_share_enable'
                            : 'erd2_share_disable',
                        window.location.pathname,
                        {}
                    );
                }
            } else if (result.code === 'pro_required') {
                setError('Публичные ссылки доступны с Pro.');
            } else {
                setError('Не удалось сохранить настройки. Попробуйте ещё раз.');
            }
        },
        [diagramId]
    );

    const origin = window.location.origin;
    const copy = async (key: 'link' | 'embed', text: string) => {
        try {
            if (!navigator.clipboard) return;
            await navigator.clipboard.writeText(text);
        } catch {
            return;
        }
        setCopied(key);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(null), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Поделиться схемой</DialogTitle>
                    <DialogDescription>
                        Ссылка только для чтения: посетители смотрят схему, но
                        не меняют её. Поисковики такие страницы не индексируют.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Загрузка…</p>
                ) : !state ? (
                    <p className="text-sm">
                        Схема ещё не сохранена в облаке. Подождите несколько
                        секунд после правки и откройте окно снова.
                    </p>
                ) : !state.can_share && !state.is_public ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm">
                            Публичные ссылки и встраивание доступны с Pro.
                        </p>
                        <Button asChild>
                            <a href={appUrl(PRICING_PATH)}>Посмотреть тарифы</a>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <label className="flex items-center justify-between gap-3 text-sm">
                            <span>Доступ по ссылке</span>
                            <input
                                type="checkbox"
                                role="switch"
                                checked={state.is_public}
                                disabled={busy}
                                onChange={(event) =>
                                    void apply({
                                        is_public: event.target.checked,
                                    })
                                }
                            />
                        </label>

                        {state.grace_until ? (
                            <p className="text-sm text-amber-600">
                                Доступ закроется{' '}
                                {new Date(state.grace_until).toLocaleDateString(
                                    'ru-RU'
                                )}
                                {' — продлите подписку.'}
                            </p>
                        ) : null}

                        {state.is_public &&
                        !state.can_share &&
                        !state.grace_until ? (
                            <p className="text-sm text-amber-600">
                                Ссылка сейчас закрыта: подписка закончилась.
                                Продлите подписку — ссылка заработает снова.
                            </p>
                        ) : null}

                        {state.is_public ? (
                            <>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                        Тема
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {PUBLIC_THEMES.map((theme) => (
                                            <Button
                                                key={theme}
                                                size="sm"
                                                variant={
                                                    state.public_theme === theme
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={busy}
                                                onClick={() =>
                                                    void apply({
                                                        public_theme: theme,
                                                    })
                                                }
                                            >
                                                {THEME_LABELS[theme]}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                        Ссылка
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm"
                                            value={publicLink(
                                                origin,
                                                APP_BASE,
                                                diagramId
                                            )}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                void copy(
                                                    'link',
                                                    publicLink(
                                                        origin,
                                                        APP_BASE,
                                                        diagramId
                                                    )
                                                )
                                            }
                                        >
                                            {copied === 'link'
                                                ? 'Скопировано'
                                                : 'Копировать'}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                        Встроить на страницу
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs"
                                            value={embedCode(
                                                origin,
                                                APP_BASE,
                                                diagramId
                                            )}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                void copy(
                                                    'embed',
                                                    embedCode(
                                                        origin,
                                                        APP_BASE,
                                                        diagramId
                                                    )
                                                )
                                            }
                                        >
                                            {copied === 'embed'
                                                ? 'Скопировано'
                                                : 'Копировать'}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </DialogContent>
        </Dialog>
    );
};
