import React, { useEffect, useState } from 'react';
import TimeAgo from 'timeago-react';
import { useChartDB } from '@/hooks/use-chartdb';
import { Badge } from '@/components/badge/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useTranslation } from 'react-i18next';
import type { LocaleFunc } from 'timeago.js';
import { register as registerLocale } from 'timeago.js';
import { Save, Loader2 } from 'lucide-react';
import { isLoggedIn } from '@/lib/sqllab-account';
import { emitSyncNow, onSyncStatus } from '@/lib/sync-status-events';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';

export interface LastSavedProps {}

const timeAgolocaleFromLanguage = async (
    language: string
): Promise<{ locale: LocaleFunc; lang: string }> => {
    let locale: LocaleFunc;
    let lang: string;
    switch (language) {
        case 'es':
            locale = (await import('timeago.js/lib/lang/es')).default;
            lang = 'es';
            break;
        case 'fr':
            locale = (await import('timeago.js/lib/lang/fr')).default;
            lang = 'fr';
            break;
        case 'de':
            locale = (await import('timeago.js/lib/lang/de')).default;
            lang = 'de';
            break;
        case 'hi':
            locale = (await import('timeago.js/lib/lang/hi_IN')).default;
            lang = 'hi_IN';
            break;
        case 'ja':
            locale = (await import('timeago.js/lib/lang/ja')).default;
            lang = 'ja';
            break;
        case 'ko_KR':
            locale = (await import('timeago.js/lib/lang/ko')).default;
            lang = 'ko';
            break;
        case 'ru':
            locale = (await import('timeago.js/lib/lang/ru')).default;
            lang = 'ru';
            break;
        case 'zh_CN':
            locale = (await import('timeago.js/lib/lang/zh_CN')).default;
            lang = 'zh_CN';
            break;
        case 'zh_TW':
            locale = (await import('timeago.js/lib/lang/zh_TW')).default;
            lang = 'zh_TW';
            break;
        case 'pt_BR':
            locale = (await import('timeago.js/lib/lang/pt_BR')).default;
            lang = 'pt_BR';
            break;
        case 'bn':
            locale = (await import('timeago.js/lib/lang/bn_IN')).default;
            lang = 'bn';
            break;
        default:
            locale = (await import('timeago.js/lib/lang/en_US')).default;
            lang = 'en_US';
            break;
    }
    return { locale, lang };
};

export const LastSaved: React.FC<LastSavedProps> = () => {
    const { currentDiagram } = useChartDB();
    const { i18n } = useTranslation();
    const [language, setLanguage] = useState<string>('en_US');
    const [syncing, setSyncing] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    useEffect(() => {
        const updateLocale = async () => {
            const { locale, lang } = await timeAgolocaleFromLanguage(
                i18n.language
            );

            registerLocale(i18n.language, locale);
            setLanguage(lang);
        };

        updateLocale();
    }, [i18n.language]);

    useEffect(
        () => onSyncStatus((status) => setSyncing(status === 'syncing')),
        []
    );

    const handleClick = () => {
        if (!isLoggedIn()) {
            setShowLoginPrompt(true);
            return;
        }
        emitSyncNow();
    };

    return (
        <>
            <Tooltip>
                <TooltipTrigger onClick={handleClick}>
                    <Badge
                        variant="secondary"
                        className="flex gap-1.5 whitespace-nowrap"
                    >
                        {syncing ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        <TimeAgo
                            datetime={currentDiagram.updatedAt}
                            locale={language}
                        />
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    {currentDiagram.updatedAt.toLocaleString()}
                </TooltipContent>
            </Tooltip>
            <LoginPromptDialog
                open={showLoginPrompt}
                onOpenChange={setShowLoginPrompt}
                reason="save_landing"
            />
        </>
    );
};
