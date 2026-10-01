import type React from 'react';

// Если мы уже на странице /about и ссылка ведёт на её же якорь — плавно скроллим без перезагрузки.
export const handleAboutHashClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
) => {
    // Клики с модификаторами и не основной кнопкой (новая вкладка/окно) — на откуп браузеру
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
    const [path, hash] = href.split('#');
    if (!hash || !path) return;
    const current = window.location.pathname.replace(/\/+$/, '');
    // Лендинг живёт и на /about, и на корне приложения (/tools/erd2/): на обоих скроллим на месте.
    const root = path.replace(/\/about$/, '');
    if (!path.endsWith('/about') || (current !== path && current !== root))
        return;
    const element = document.getElementById(hash);
    if (!element) return;
    e.preventDefault();
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.pushState(window.history.state, '', href);
};
