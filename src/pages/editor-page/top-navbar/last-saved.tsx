import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
    emitSyncNow,
    onSyncNotice,
    onSyncStatus,
    type SyncNotice,
} from '@/lib/sync-status-events';
import { PRICING_PATH } from '@/lib/erd-paths';
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
    const [failed, setFailed] = useState(false);
    const [notice, setNotice] = useState<SyncNotice | null>(null);
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
        () =>
            onSyncStatus((status) => {
                setSyncing(status === 'syncing');
                setFailed(status === 'error');
            }),
        []
    );

    useEffect(() => onSyncNotice((n) => setNotice(n)), []);
    // Подсказка относится к конкретной схеме — при переходе на другую убираем.
    useEffect(() => setNotice(null), [currentDiagram.id]);

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
                        {failed ? (
                            <span className="text-destructive">
                                {notice?.kind === 'conflict'
                                    ? 'Схема изменена на другом устройстве'
                                    : 'Не сохранено в облаке'}
                            </span>
                        ) : (
                            <TimeAgo
                                datetime={currentDiagram.updatedAt}
                                locale={language}
                            />
                        )}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    {currentDiagram.updatedAt.toLocaleString()}
                </TooltipContent>
            </Tooltip>
            {notice?.kind === 'conflict' ? (
                <Badge
                    variant="outline"
                    className="hidden items-center gap-1.5 whitespace-nowrap md:flex"
                >
                    Эта версия устарела — перезагрузите страницу, чтобы
                    подтянуть свежую.
                </Badge>
            ) : notice ? (
                <Badge
                    variant="outline"
                    className="hidden items-center gap-1.5 whitespace-nowrap md:flex"
                >
                    Сохранено в облаке. На другом устройстве эта схема откроется
                    только с Pro.
                    <Link to={PRICING_PATH} className="underline">
                        Подробнее
                    </Link>
                </Badge>
            ) : null}
            <LoginPromptDialog
                open={showLoginPrompt}
                onOpenChange={setShowLoginPrompt}
                reason="save_landing"
            />
        </>
    );
};
