// Polyfills must be imported first for Safari compatibility
import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './globals.css';
import { App } from './app';
import { router } from './router';
import './i18n/i18n';
import { reloadOnceForStaleChunk } from './lib/reload-on-stale-chunk';
import { waitForPrerenderedPage } from './lib/wait-for-prerendered-page';
import { loadMetrika } from './lib/cookie-consent';

// Vite шлёт это событие, когда не удалось подгрузить чанк (например, после деплоя новой версии)
window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
});

// Метрика грузится только при согласии; «Принять» в баннере запускает её без перезагрузки
loadMetrika();

const rootElement = document.getElementById('root')!;

// Если в #root лежит предрендеренная страница, не затираем её, пока роутер не загрузит ленивый маршрут
void waitForPrerenderedPage(rootElement, router).then(() => {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
});
