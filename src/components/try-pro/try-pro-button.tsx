import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { trackEvent } from '@/lib/sqllab-account';

const BENEFITS = [
    'Больше схем в облаке: 3 на Free → 25 на ERD Pro → без лимита на общем Pro',
    'Больше таблиц в схеме при сохранении в облако: 10 → 100 → 200',
    'Общий Pro — то же самое плюс все курсы SQL и тренажёр',
];

export const TryProButton: React.FC = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setOpen(true);
                    trackEvent('erd2_try_pro_click', window.location.pathname);
                }}
                className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-sm font-medium text-pink-700 hover:bg-pink-100 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-300 dark:hover:bg-pink-950"
            >
                <Crown className="size-3.5" />
                Улучшить до Pro
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Расширьте возможности</DialogTitle>
                        <DialogDescription>
                            Получите больше возможностей для работы со схемами в
                            облаке.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {BENEFITS.map((text) => (
                            <li key={text}>{text}</li>
                        ))}
                    </ul>
                    <DialogFooter>
                        <Button asChild>
                            <Link to="/pricing" onClick={() => setOpen(false)}>
                                Смотреть тарифы
                            </Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
