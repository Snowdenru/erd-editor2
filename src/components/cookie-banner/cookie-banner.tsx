import React, { useEffect, useState } from 'react';
import { Button } from '@/components/button/button';
import {
    acceptConsent,
    CONSENT_EVENT,
    hasAnsweredConsent,
} from '@/lib/cookie-consent';

const SITE = 'https://sqllab.ru';

// Тот же баннер, что на основном сайте: только «Принять». Ответ общий (см. cookie-consent.ts).
export const CookieBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // В предрендеренный about.html баннер попадать не должен
        if (window.__ERD2_PRERENDER__ || window.__ERD2_REDIRECTING__) return;
        setVisible(!hasAnsweredConsent());
        // Согласие могли дать в соседней вкладке или на основном сайте
        const sync = () => setVisible(!hasAnsweredConsent());
        window.addEventListener('storage', sync);
        window.addEventListener(CONSENT_EVENT, sync);
        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener(CONSENT_EVENT, sync);
        };
    }, []);

    if (!visible) return null;

    const link = 'text-foreground underline underline-offset-2';

    return (
        <div
            role="region"
            aria-label="Уведомление о куках"
            className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 shadow-lg backdrop-blur-sm"
        >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="pr-4 text-sm leading-relaxed text-muted-foreground">
                    Мы используем куки для корректной работы сайта. Продолжая
                    использование сайта, вы соглашаетесь с{' '}
                    <a
                        href={`${SITE}/legal/cookies`}
                        className={link}
                        target="_blank"
                        rel="noreferrer"
                    >
                        политикой куков
                    </a>{' '}
                    и{' '}
                    <a
                        href={`${SITE}/legal/privacy`}
                        className={link}
                        target="_blank"
                        rel="noreferrer"
                    >
                        политикой конфиденциальности
                    </a>
                    .
                </p>
                <Button className="shrink-0" onClick={acceptConsent}>
                    Принять
                </Button>
            </div>
        </div>
    );
};
