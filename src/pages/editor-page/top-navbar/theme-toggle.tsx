import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/button/button-variants';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';

export const ThemeToggle: React.FC = () => {
    const { t } = useTranslation();
    const { effectiveTheme, setTheme } = useTheme();
    const isDark = effectiveTheme === 'dark';
    const label = isDark
        ? t('theme_toggle.switch_to_light')
        : t('theme_toggle.switch_to_dark');

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className={cn(
                        buttonVariants({ variant: 'outline', size: 'icon' }),
                        'size-6 cursor-pointer rounded-full md:size-8'
                    )}
                >
                    {isDark ? (
                        <Sun className="size-3.5 md:size-4" />
                    ) : (
                        <Moon className="size-3.5 md:size-4" />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
};
