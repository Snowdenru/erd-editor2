import type React from 'react';

// Если мы уже на странице /about и ссылка ведёт на её же якорь — плавно скроллим без перезагрузки.
export const handleAboutHashClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
) => {
    const [path, hash] = href.split('#');
    if (!hash || !path) return;
    const current = window.location.pathname.replace(/\/+$/, '');
    if (!current.endsWith('/about') || current !== path) return;
    const element = document.getElementById(hash);
    if (!element) return;
    e.preventDefault();
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.pushState({}, '', href);
};
