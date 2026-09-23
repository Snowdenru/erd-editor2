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
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/sidebar/sidebar';
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
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton
                        type="button"
                        className="justify-center space-y-0.5 !px-0 text-muted-foreground"
                        onClick={() =>
                            window.location.assign(
                                buildLoginUrl(
                                    `${window.location.pathname}${window.location.search}`
                                )
                            )
                        }
                    >
                        <Avatar className="size-7">
                            <AvatarFallback>
                                <CircleUserRound className="size-4" />
                            </AvatarFallback>
                        </Avatar>
                        <span>Войти</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    const handleLogout = () => {
        void logout().finally(() => {
            window.location.assign(`${APP_BASE}/`);
        });
    };

    return (
        <DropdownMenu>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            type="button"
                            className="justify-center space-y-0.5 !px-0"
                        >
                            <Avatar className="size-7">
                                <AvatarFallback>
                                    {profile ? (
                                        getInitials(
                                            profile.full_name,
                                            profile.email
                                        )
                                    ) : (
                                        <CircleUserRound className="size-4" />
                                    )}
                                </AvatarFallback>
                            </Avatar>
                            <span>
                                {profile ? profile.full_name : 'Аккаунт'}
                            </span>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                </SidebarMenuItem>
            </SidebarMenu>
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
