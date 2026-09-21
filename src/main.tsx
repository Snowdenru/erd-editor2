// Polyfills must be imported first for Safari compatibility
import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './globals.css';
import { App } from './app';
import './i18n/i18n';
import { reloadOnceForStaleChunk } from './lib/reload-on-stale-chunk';

// Vite шлёт это событие, когда не удалось подгрузить чанк (например, после деплоя новой версии)
window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
