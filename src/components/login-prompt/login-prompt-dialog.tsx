import React, { useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { buildLoginUrl, trackEvent } from '@/lib/sqllab-account';

export type LoginPromptReason = 'export' | 'save_landing';

const COPY: Record<
    LoginPromptReason,
    { title: string; description: string; primary: string; secondary: string }
> = {
    export: {
        title: 'Экспорт бесплатный после входа',
        description:
            'Войдите через Яндекс, VK или почту — это займёт минуту. Схема сохранится в облаке и будет доступна с любого устройства.',
        primary: 'Войти',
        secondary: 'Не сейчас',
    },
    save_landing: {
        title: 'Сохраните схему в облаке',
        description:
            'Войдите, чтобы схема не потерялась и открывалась с любого устройства. Можно продолжить и без входа — тогда схема останется только в этом браузере.',
        primary: 'Войти и сохранить',
        secondary: 'Продолжить без входа',
    },
};

export interface LoginPromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reason: LoginPromptReason;
    returnPath?: string;
    onSecondary?: () => void;
}

export const LoginPromptDialog: React.FC<LoginPromptDialogProps> = ({
    open,
    onOpenChange,
    reason,
    returnPath,
    onSecondary,
}) => {
    const copy = COPY[reason];

    useEffect(() => {
        if (open) {
            trackEvent('erd2_login_prompt', window.location.pathname, {
                reason,
            });
        }
    }, [open, reason]);

    const goToLogin = () => {
        const path =
            returnPath ??
            `${window.location.pathname}${window.location.search}`;
        window.location.assign(buildLoginUrl(path));
    };

    const handleSecondary = () => {
        onOpenChange(false);
        onSecondary?.();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleSecondary}>
                        {copy.secondary}
                    </Button>
                    <Button onClick={goToLogin}>{copy.primary}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
