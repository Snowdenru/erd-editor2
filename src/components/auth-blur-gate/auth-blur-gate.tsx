import React from 'react';
import { Lock } from 'lucide-react';
import { isLoggedIn, buildLoginUrl } from '@/lib/sqllab-account';

export interface AuthBlurGateProps {
    children: React.ReactNode;
}

export const AuthBlurGate: React.FC<AuthBlurGateProps> = ({ children }) => {
    if (isLoggedIn()) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex-1 overflow-hidden">
            <div
                aria-hidden
                className="pointer-events-none flex h-full select-none flex-col overflow-hidden blur-sm"
            >
                {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <button
                    type="button"
                    onClick={() =>
                        window.location.assign(
                            buildLoginUrl(
                                `${window.location.pathname}${window.location.search}`
                            )
                        )
                    }
                    className="flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border hover:bg-accent"
                >
                    <Lock className="size-3.5" />
                    Войти
                </button>
            </div>
        </div>
    );
};
