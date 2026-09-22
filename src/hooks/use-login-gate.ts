import { useCallback, useState } from 'react';
import { isLoggedIn } from '@/lib/sqllab-account';

// guard() — true, если пользователь вошёл; иначе открывает приглашение войти и возвращает false
export function useLoginGate() {
    const [promptOpen, setPromptOpen] = useState(false);

    const guard = useCallback((): boolean => {
        if (isLoggedIn()) {
            return true;
        }
        setPromptOpen(true);
        return false;
    }, []);

    return { guard, promptOpen, setPromptOpen };
}
