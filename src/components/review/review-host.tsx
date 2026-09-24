import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/button/button';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { ReviewDialog } from '@/components/review/review-dialog';
import { canAutoPrompt, markPromptDismissed } from '@/lib/erd2-review';
import { onReviewSignal } from '@/lib/review-events';
import { isLoggedIn, trackEvent } from '@/lib/sqllab-account';

const AUTO_PROMPT_AFTER_MS = 5 * 60_000;

export const ReviewHost: React.FC = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [nudgeVisible, setNudgeVisible] = useState(false);

    // Зеркала состояния: showNudge остаётся стабильным, таймер не пересоздаётся
    const nudgeVisibleRef = useRef(false);
    const dialogOpenRef = useRef(false);
    const loginOpenRef = useRef(false);
    nudgeVisibleRef.current = nudgeVisible;
    dialogOpenRef.current = dialogOpen;
    loginOpenRef.current = loginOpen;

    const showNudge = useCallback(() => {
        if (
            nudgeVisibleRef.current ||
            dialogOpenRef.current ||
            loginOpenRef.current
        ) {
            return;
        }
        // Оценка привязана к аккаунту: анониму не предлагаем, только по явному клику в сайдбаре
        if (!isLoggedIn() || !canAutoPrompt()) {
            return;
        }
        nudgeVisibleRef.current = true;
        setNudgeVisible(true);
        trackEvent('erd2_review_prompt', window.location.pathname, {
            action: 'shown',
        });
    }, []);

    const openReview = useCallback(() => {
        setNudgeVisible(false);
        if (isLoggedIn()) {
            setDialogOpen(true);
        } else {
            setLoginOpen(true);
        }
    }, []);

    useEffect(
        () =>
            onReviewSignal((signal) => {
                if (signal === 'open') {
                    openReview();
                } else {
                    showNudge();
                }
            }),
        [openReview, showNudge]
    );

    useEffect(() => {
        const timer = setTimeout(showNudge, AUTO_PROMPT_AFTER_MS);
        return () => clearTimeout(timer);
    }, [showNudge]);

    const acceptNudge = () => {
        // Принятое, но отменённое предложение не должно возвращаться 30 дней
        markPromptDismissed();
        openReview();
    };

    const dismissNudge = () => {
        markPromptDismissed();
        setNudgeVisible(false);
        trackEvent('erd2_review_prompt', window.location.pathname, {
            action: 'dismissed',
        });
    };

    return (
        <>
            {nudgeVisible && (
                <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border bg-card p-4 shadow-lg">
                    <button
                        type="button"
                        aria-label="Закрыть"
                        onClick={dismissNudge}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                    <p className="text-sm font-semibold">Как вам редактор?</p>
                    <p className="mb-3 mt-1 text-xs text-muted-foreground">
                        Оценка занимает полминуты и помогает нам его улучшать.
                    </p>
                    <Button type="button" size="sm" onClick={acceptNudge}>
                        Оценить
                    </Button>
                </div>
            )}
            <ReviewDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            <LoginPromptDialog
                open={loginOpen}
                onOpenChange={setLoginOpen}
                reason="review"
                returnPath={`${window.location.pathname}${window.location.search}`}
            />
        </>
    );
};
