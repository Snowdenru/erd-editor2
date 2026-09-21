import React, { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { Spinner } from '@/components/spinner/spinner';
import { Button } from '@/components/button/button';
import {
    isStaleChunkError,
    reloadOnceForStaleChunk,
} from '@/lib/reload-on-stale-chunk';

export const RouteError: React.FC = () => {
    const error = useRouteError();
    const isStale = isStaleChunkError(error);

    useEffect(() => {
        if (isStale) {
            reloadOnceForStaleChunk();
        }
    }, [isStale]);

    if (isStale) {
        // Пока идёт автоматическая перезагрузка — показываем спиннер, а не страницу с ошибкой
        return (
            <div className="flex h-screen items-center justify-center">
                <Spinner size="large" className="text-pink-600" />
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-2xl font-bold">Что-то пошло не так</h1>
            <p className="max-w-md text-muted-foreground">
                Не удалось загрузить страницу. Обновите её — обычно этого
                достаточно.
            </p>
            <Button onClick={() => window.location.reload()}>Обновить</Button>
        </div>
    );
};
