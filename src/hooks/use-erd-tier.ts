import { useEffect, useState } from 'react';
import { fetchLimits, isLoggedIn, type ErdTier } from '@/lib/sqllab-account';

// Текущий тариф пользователя ('free' для анонима или без подписки, пока не
// пришёл ответ — null). Используется, чтобы не показывать призыв "Улучшить
// до Pro" тем, у кого уже есть ERD Pro или общий Pro.
export function useErdTier(): ErdTier | null {
    const [tier, setTier] = useState<ErdTier | null>(
        isLoggedIn() ? null : 'free'
    );

    useEffect(() => {
        if (!isLoggedIn()) {
            setTier('free');
            return;
        }
        let cancelled = false;
        fetchLimits()
            .then((limits) => {
                if (!cancelled) setTier(limits.tier);
            })
            .catch(() => {
                if (!cancelled) setTier('free');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return tier;
}
