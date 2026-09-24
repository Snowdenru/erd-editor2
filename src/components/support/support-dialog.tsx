import React from 'react';
import { Mail, Send } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';

export const SUPPORT_EMAIL = 'sqllab@yandex.ru';
export const SUPPORT_TELEGRAM = 'sqllab_support';

export interface SupportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SupportDialog: React.FC<SupportDialogProps> = ({
    open,
    onOpenChange,
}) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle>Поддержка</DialogTitle>
                <DialogDescription>
                    Что-то не работает или есть вопрос по редактору? Напишите
                    нам, обычно отвечаем в течение дня.
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
                <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Вопрос по ERD-редактору SQL Lab`}
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent"
                >
                    <Mail className="size-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm">
                        <span className="block font-medium">Почта</span>
                        <span className="text-muted-foreground">
                            {SUPPORT_EMAIL}
                        </span>
                    </span>
                </a>
                <a
                    href={`https://t.me/${SUPPORT_TELEGRAM}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent"
                >
                    <Send className="size-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm">
                        <span className="block font-medium">Telegram</span>
                        <span className="text-muted-foreground">
                            @{SUPPORT_TELEGRAM}
                        </span>
                    </span>
                </a>
            </div>
        </DialogContent>
    </Dialog>
);
