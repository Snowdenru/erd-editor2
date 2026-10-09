import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Helmet } from 'react-helmet-async';
import { ReactFlowProvider } from '@xyflow/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ThemeContext } from '@/context/theme-context/theme-context';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ChartDBProvider } from '@/context/chartdb-context/chartdb-provider';
import { DiffProvider } from '@/context/diff-context/diff-provider';
import { Canvas } from '@/pages/editor-page/canvas/canvas';
import { FitToTables } from '@/components/fit-to-tables/fit-to-tables';
import { Spinner } from '@/components/spinner/spinner';
import { Button } from '@/components/button/button';
import { reviveDiagram } from '@/lib/cloud-diagrams';
import { NEW_DIAGRAM_PATH } from '@/lib/erd-paths';
import { appUrl } from '@/lib/app-config';
import {
    applyPalette,
    fetchPublicDiagram,
    resolveTheme,
    themeMode,
    type PublicDiagram,
    type PublicTheme,
} from '@/lib/public-share';
import { trackEvent } from '@/lib/sqllab-account';
import type { Theme } from '@/lib/types';

type LoadState =
    | { kind: 'loading' }
    | { kind: 'ready'; diagram: PublicDiagram }
    | { kind: 'missing'; code: 'not_found' | 'closed' | 'error' };

const MESSAGES: Record<'not_found' | 'closed' | 'error', string> = {
    not_found: 'Схема не найдена',
    closed: 'Владелец закрыл доступ к этой схеме',
    error: 'Не удалось загрузить схему. Попробуйте позже.',
};

// Тема просмотра живёт в своём контексте и не пишется в localStorage:
// иначе открытая чужая схема меняла бы тему собственного редактора посетителя.
const ViewerTheme: React.FC<
    React.PropsWithChildren<{
        mode: 'light' | 'dark';
        onSetMode: (mode: 'light' | 'dark') => void;
    }>
> = ({ mode, onSetMode, children }) => {
    // Исходное состояние класса страницы запоминаем один раз, при монтировании.
    const [hadDark] = useState(() =>
        document.documentElement.classList.contains('dark')
    );
    useEffect(() => {
        document.documentElement.classList.toggle('dark', mode === 'dark');
    }, [mode]);
    useEffect(
        () => () => {
            document.documentElement.classList.toggle('dark', hadDark);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    const setTheme = useCallback(
        (t: Theme) => onSetMode(t === 'dark' ? 'dark' : 'light'),
        [onSetMode]
    );
    const value = useMemo(
        () => ({
            theme: mode as Theme,
            effectiveTheme: mode,
            setTheme,
        }),
        [mode, setTheme]
    );
    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

const PublicViewInner: React.FC<{ embed: boolean }> = ({ embed }) => {
    const { id = '' } = useParams<{ id: string }>();
    const [search] = useSearchParams();
    const [state, setState] = useState<LoadState>({ kind: 'loading' });
    const [visitorMode, setVisitorMode] = useState<'light' | 'dark' | null>(
        null
    );
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        void fetchPublicDiagram(id).then((res) => {
            if (cancelled) return;
            if (res.ok) {
                setState({ kind: 'ready', diagram: res.diagram });
                trackEvent('erd2_public_view', window.location.pathname, {
                    embed,
                });
            } else {
                setState({ kind: 'missing', code: res.code });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [id, embed]);

    const diagram = state.kind === 'ready' ? state.diagram : null;
    const theme: PublicTheme = resolveTheme(
        search.get('theme'),
        diagram?.public_theme ?? null
    );
    const mode = visitorMode ?? themeMode(theme);

    const revived = useMemo(() => {
        if (!diagram) return null;
        const base = reviveDiagram({
            id: diagram.id,
            title: diagram.title,
            updated_at: diagram.updated_at,
            content: diagram.content,
        });
        if (!base) return null;
        return { ...base, tables: applyPalette(base.tables ?? [], theme) };
    }, [diagram, theme]);

    if (state.kind === 'loading') {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Spinner size="large" />
            </div>
        );
    }

    if (state.kind === 'missing' || !diagram || !revived) {
        const code = state.kind === 'missing' ? state.code : 'error';
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                <Helmet>
                    <meta name="robots" content="noindex,nofollow" />
                    <title>{`${MESSAGES[code]} | SQL Lab`}</title>
                </Helmet>
                <p className="text-lg font-semibold">{MESSAGES[code]}</p>
                <Button asChild variant="outline">
                    <a href={appUrl(NEW_DIAGRAM_PATH)}>Создать свою схему</a>
                </Button>
            </div>
        );
    }

    const graceUntil = diagram.grace_until
        ? new Date(diagram.grace_until).toLocaleDateString('ru-RU')
        : null;

    return (
        <ViewerTheme mode={mode} onSetMode={setVisitorMode}>
            <Helmet>
                <meta name="robots" content="noindex,nofollow" />
                <title>{`${diagram.title} — схема базы данных | SQL Lab`}</title>
            </Helmet>
            <section className="flex h-screen w-screen flex-col bg-background">
                {!embed ? (
                    <nav className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                        <h1 className="truncate font-primary text-base font-semibold">
                            {diagram.title}
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setVisitorMode(
                                        mode === 'dark' ? 'light' : 'dark'
                                    )
                                }
                            >
                                {mode === 'dark' ? 'Светлая' : 'Тёмная'}
                            </Button>
                            <Button asChild size="sm">
                                <a href={appUrl(NEW_DIAGRAM_PATH)}>
                                    Создать свою схему
                                </a>
                            </Button>
                        </div>
                    </nav>
                ) : null}
                {graceUntil ? (
                    <div className="shrink-0 bg-amber-100 px-4 py-1 text-center text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        Доступ скоро закроется ({graceUntil}) — владельцу нужно
                        продлить подписку.
                    </div>
                ) : null}
                <div ref={containerRef} className="relative flex-1">
                    <DiffProvider>
                        <ChartDBProvider diagram={revived} readonly>
                            <Canvas initialTables={revived.tables ?? []} />
                            <FitToTables
                                tables={revived.tables ?? []}
                                containerRef={containerRef}
                            />
                        </ChartDBProvider>
                    </DiffProvider>
                    {embed ? (
                        <a
                            href={appUrl('/')}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-2 right-2 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            ERD · sqllab.ru
                        </a>
                    ) : null}
                </div>
            </section>
        </ViewerTheme>
    );
};

export const PublicViewPage: React.FC<{ embed?: boolean }> = ({
    embed = false,
}) => (
    <LocalConfigProvider>
        <ReactFlowProvider>
            <PublicViewInner embed={embed} />
        </ReactFlowProvider>
    </LocalConfigProvider>
);
