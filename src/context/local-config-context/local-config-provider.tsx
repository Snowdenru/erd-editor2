import React, { useEffect } from 'react';
import type { ScrollAction } from './local-config-context';
import { LocalConfigContext } from './local-config-context';
import type { Theme } from '../theme-context/theme-context';

// В iframe на чужом сайте с заблокированным хранилищем обращение к localStorage бросает SecurityError
const safeGet = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeSet = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // хранилище недоступно: настройки живут только до перезагрузки
    }
};

const themeKey = 'theme';
const scrollActionKey = 'scroll_action';
const showCardinalityKey = 'show_cardinality';
const showFieldAttributesKey = 'show_field_attributes';
const githubRepoOpenedKey = 'github_repo_opened';
const starUsDialogLastOpenKey = 'star_us_dialog_last_open';
const showMiniMapOnCanvasKey = 'show_minimap_on_canvas';
// v2: старый ключ у всех уже хранит 'false' (провайдер записывает умолчание при первом визите) — меняем ключ, чтобы новое умолчание true применилось и к существующим пользователям
const showDBViewsKey = 'show_db_views_v2';

export const LocalConfigProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [theme, setTheme] = React.useState<Theme>(
        (safeGet(themeKey) as Theme) || 'system'
    );

    const [scrollAction, setScrollAction] = React.useState<ScrollAction>(
        (safeGet(scrollActionKey) as ScrollAction) || 'pan'
    );

    const [showDBViews, setShowDBViews] = React.useState<boolean>(
        // По умолчанию показываем вьюхи: иначе в готовых схемах (например, зона Current Status в Employees) области выглядят пустыми
        (safeGet(showDBViewsKey) ?? 'true') === 'true'
    );

    const [showCardinality, setShowCardinality] = React.useState<boolean>(
        (safeGet(showCardinalityKey) || 'true') === 'true'
    );

    const [showFieldAttributes, setShowFieldAttributes] =
        React.useState<boolean>(
            (safeGet(showFieldAttributesKey) || 'true') === 'true'
        );

    const [githubRepoOpened, setGithubRepoOpened] = React.useState<boolean>(
        (safeGet(githubRepoOpenedKey) || 'false') === 'true'
    );

    const [starUsDialogLastOpen, setStarUsDialogLastOpen] =
        React.useState<number>(
            parseInt(safeGet(starUsDialogLastOpenKey) || '0')
        );

    const [showMiniMapOnCanvas, setShowMiniMapOnCanvas] =
        React.useState<boolean>(
            (safeGet(showMiniMapOnCanvasKey) || 'true') === 'true'
        );

    useEffect(() => {
        safeSet(starUsDialogLastOpenKey, starUsDialogLastOpen.toString());
    }, [starUsDialogLastOpen]);

    useEffect(() => {
        safeSet(githubRepoOpenedKey, githubRepoOpened.toString());
    }, [githubRepoOpened]);

    useEffect(() => {
        safeSet(themeKey, theme);
    }, [theme]);

    useEffect(() => {
        safeSet(scrollActionKey, scrollAction);
    }, [scrollAction]);

    useEffect(() => {
        safeSet(showDBViewsKey, showDBViews.toString());
    }, [showDBViews]);

    useEffect(() => {
        safeSet(showCardinalityKey, showCardinality.toString());
    }, [showCardinality]);

    useEffect(() => {
        safeSet(showMiniMapOnCanvasKey, showMiniMapOnCanvas.toString());
    }, [showMiniMapOnCanvas]);

    return (
        <LocalConfigContext.Provider
            value={{
                theme,
                setTheme,
                scrollAction,
                setScrollAction,
                showDBViews,
                setShowDBViews,
                showCardinality,
                setShowCardinality,
                showFieldAttributes,
                setShowFieldAttributes,
                setGithubRepoOpened,
                githubRepoOpened,
                starUsDialogLastOpen,
                setStarUsDialogLastOpen,
                showMiniMapOnCanvas,
                setShowMiniMapOnCanvas,
            }}
        >
            {children}
        </LocalConfigContext.Provider>
    );
};
