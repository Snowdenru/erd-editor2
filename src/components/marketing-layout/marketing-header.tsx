import React from 'react';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import ChartDBLogo from '@/assets/sqllab-logo-light.svg';
import ChartDBDarkLogo from '@/assets/sqllab-logo-dark.svg';
import { Button } from '@/components/button/button';
import { useTheme } from '@/hooks/use-theme';

// Якоря (#features, #databases) есть только на /about — с других страниц ведём на /about#...
const HEADER_LINKS: Array<{ label: string; href: string }> = [
    { label: 'Возможности', href: '/tools/erd2/about#features' },
    { label: 'Поддержка БД', href: '/tools/erd2/about#databases' },
    { label: 'Шаблоны', href: '/tools/erd2/templates' },
    { label: 'Инструменты', href: '/tools' },
    { label: 'Цены', href: '/tools/erd2/pricing' },
];

export const MarketingHeader: React.FC = () => {
    const { effectiveTheme } = useTheme();

    return (
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
            <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-6">
                <a
                    href="https://sqllab.ru"
                    className="flex shrink-0 cursor-pointer items-center"
                    rel="noreferrer"
                >
                    <img
                        src={
                            effectiveTheme === 'light'
                                ? ChartDBLogo
                                : ChartDBDarkLogo
                        }
                        alt="SQL Lab"
                        className="h-4 max-w-fit"
                    />
                </a>
                <div className="hidden items-center gap-1 md:flex">
                    {HEADER_LINKS.map(({ label, href }) => (
                        <a
                            key={label}
                            href={href}
                            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            {label}
                        </a>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/courses"
                        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950"
                    >
                        <GraduationCap className="size-4" />
                        Изучать SQL
                    </a>
                    <Button asChild size="sm" className="hidden sm:inline-flex">
                        <Link to="/">Открыть редактор</Link>
                    </Button>
                </div>
            </nav>
        </header>
    );
};
