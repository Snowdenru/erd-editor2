import React, { useEffect, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/dropdown-menu/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/avatar/avatar';
import { useDialog } from '@/hooks/use-dialog';
import {
    APP_BASE,
    buildLoginUrl,
    fetchProfile,
    isLoggedIn,
    type UserProfileSummary,
} from '@/lib/sqllab-account';
import { logout } from '@/lib/sqllab-auth';

const getInitials = (fullName: string, email: string): string => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
        return parts
            .slice(0, 2)
            .map((p) => p[0]!.toUpperCase())
            .join('');
    }
    return (email[0] ?? '?').toUpperCase();
};

export const AccountMenu: React.FC = () => {
    const { openOpenDiagramDialog } = useDialog();
    const [profile, setProfile] = useState<UserProfileSummary | null>(null);

    useEffect(() => {
        if (!isLoggedIn()) return;
        fetchProfile()
            .then(setProfile)
            .catch(() => undefined);
    }, []);

    if (!isLoggedIn()) {
        return (
            <button
                type="button"
                onClick={() =>
                    window.location.assign(
                        buildLoginUrl(
                            `${window.location.pathname}${window.location.search}`
                        )
                    )
                }
                className="flex w-full items-center gap-2 rounded-md p-2 text-sm text-muted-foreground hover:bg-accent"
            >
                <Avatar className="size-7">
                    <AvatarFallback>
                        <CircleUserRound className="size-4" />
                    </AvatarFallback>
                </Avatar>
                Войти
            </button>
        );
    }

    const handleLogout = () => {
        void logout().finally(() => {
            window.location.assign(`${APP_BASE}/`);
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
                >
                    <Avatar className="size-7">
                        <AvatarFallback>
                            {profile ? (
                                getInitials(profile.full_name, profile.email)
                            ) : (
                                <CircleUserRound className="size-4" />
                            )}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                        {profile ? profile.full_name : 'Аккаунт'}
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col">
                        <span className="font-medium">
                            {profile?.full_name ?? '…'}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                            {profile?.email ?? ''}
                        </span>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openOpenDiagramDialog()}>
                    Мои схемы
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="justify-between">
                    Ссылка для встраивания
                    <span className="ml-auto text-xs text-muted-foreground">
                        Скоро
                    </span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="justify-between">
                    Пригласить в команду
                    <span className="ml-auto text-xs text-muted-foreground">
                        Скоро
                    </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link to="/pricing">Тарифы</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href="/profile">Поддержка</a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    Выйти
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
