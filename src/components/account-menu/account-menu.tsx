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
import { SupportDialog } from '@/components/support/support-dialog';
import { useErdTier } from '@/hooks/use-erd-tier';
import { emitOpenShare } from '@/lib/share-dialog-events';

const TIER_LABEL: Record<'erd' | 'pro', string> = {
    erd: 'ERD Pro',
    pro: 'Pro (вся платформа)',
};

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
    const [supportOpen, setSupportOpen] = useState(false);
    const tier = useErdTier();

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
        <>
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
                            {tier === 'erd' || tier === 'pro' ? (
                                <span className="mt-1 w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    Тариф: {TIER_LABEL[tier]}
                                </span>
                            ) : null}
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openOpenDiagramDialog()}>
                        Мои схемы
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={emitOpenShare}>
                        Ссылка для встраивания
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
                    <DropdownMenuItem onSelect={() => setSupportOpen(true)}>
                        Поддержка
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                        Выйти
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
        </>
    );
};
