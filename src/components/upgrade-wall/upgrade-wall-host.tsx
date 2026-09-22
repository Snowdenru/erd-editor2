import React, { useEffect, useState } from 'react';
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
import { onUpgradeWall } from '@/lib/upgrade-wall-events';
import type {
    UpgradeReason,
    UpgradeWallDetail,
} from '@/lib/upgrade-wall-events';
import { trackEvent } from '@/lib/sqllab-account';

const COPY = (detail: UpgradeWallDetail) =>
    detail.reason === 'diagram_limit'
        ? {
              title: 'Лимит схем в облаке',
              description: `На вашем тарифе в облаке можно хранить схем: ${detail.limit ?? 3}. Новая схема останется в этом браузере, но не появится на других устройствах. С ERD Pro в облаке хранится до 25 схем.`,
          }
        : {
              title: 'Схема больше лимита тарифа',
              description: `В схеме больше ${detail.limit ?? 10} таблиц — такое облако на вашем тарифе не сохраняет. Работать можно дальше, а сохранение в облако включится с ERD Pro (до 100 таблиц в схеме).`,
          };

// Показываем стену не чаще раза за вкладку на каждую причину: фоновая
// синхронизация повторяет попытку сохранения каждые ~2с, и без этой защиты
// диалог, который пользователь уже закрыл, снова открывался бы на каждый
// повтор 403 — мигание, которое пользователь явно просил убрать.
const SEEN_KEY = 'erd2:upgrade-wall:seen';
const DISMISSED_KEY = 'erd2:upgrade-wall:dismissed';

const readReasonSet = (key: string): Set<UpgradeReason> => {
    try {
        const raw = sessionStorage.getItem(key);
        return new Set(raw ? (JSON.parse(raw) as UpgradeReason[]) : []);
    } catch (e) {
        console.warn('Failed to read from sessionStorage:', e);
        return new Set();
    }
};

const addReasonToSet = (key: string, reason: UpgradeReason): void => {
    try {
        const set = readReasonSet(key);
        set.add(reason);
        sessionStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (e) {
        console.warn('Failed to write to sessionStorage:', e);
    }
};

export const UpgradeWallHost: React.FC = () => {
    const [detail, setDetail] = useState<UpgradeWallDetail | null>(null);

    useEffect(
        () =>
            onUpgradeWall((next) => {
                // Пользователь уже закрыл стену с этой причиной в этой
                // сессии — не открываем её повторно на очередной ретрай.
                if (readReasonSet(DISMISSED_KEY).has(next.reason)) {
                    return;
                }

                if (!readReasonSet(SEEN_KEY).has(next.reason)) {
                    addReasonToSet(SEEN_KEY, next.reason);
                    trackEvent('erd2_wall_view', window.location.pathname, {
                        reason: next.reason,
                        limit: next.limit,
                    });
                }

                setDetail(next);
            }),
        []
    );

    const dismiss = () => {
        if (detail) {
            addReasonToSet(DISMISSED_KEY, detail.reason);
        }
        setDetail(null);
    };

    if (!detail) {
        return null;
    }
    const { title, description } = COPY(detail);

    return (
        <Dialog open onOpenChange={(open) => !open && dismiss()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={dismiss}>
                        Позже
                    </Button>
                    <Button asChild>
                        <Link to="/pricing" onClick={dismiss}>
                            Смотреть тарифы
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
