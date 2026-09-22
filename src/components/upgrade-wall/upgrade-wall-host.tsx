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
import type { UpgradeWallDetail } from '@/lib/upgrade-wall-events';
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

export const UpgradeWallHost: React.FC = () => {
    const [detail, setDetail] = useState<UpgradeWallDetail | null>(null);

    useEffect(
        () =>
            onUpgradeWall((next) => {
                setDetail(next);
                trackEvent('erd2_wall_view', window.location.pathname, {
                    reason: next.reason,
                    limit: next.limit,
                });
            }),
        []
    );

    if (!detail) {
        return null;
    }
    const { title, description } = COPY(detail);

    return (
        <Dialog open onOpenChange={(open) => !open && setDetail(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDetail(null)}>
                        Позже
                    </Button>
                    <Button asChild>
                        <Link to="/pricing" onClick={() => setDetail(null)}>
                            Смотреть тарифы
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
