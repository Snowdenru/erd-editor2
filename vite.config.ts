import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import UnpluginInjectPreload from 'unplugin-inject-preload/vite';

// https://vitejs.dev/config/
// Адрес приложения: VITE_APP_BASE (по умолчанию /tools/erd2), без завершающих слэшей
const resolveBase = (mode: string): string =>
    (loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_BASE ?? '')
        .trim()
        .replace(/\/+$/, '') || '/tools/erd2';

export default defineConfig(({ mode }) => {
    const APP_BASE = resolveBase(mode);
    const htmlAppBase: Plugin = {
        name: 'html-app-base',
        transformIndexHtml: (html) => html.replaceAll('%APP_BASE%', APP_BASE),
    };
    return {
        base: `${APP_BASE}/`,
        plugins: [
            htmlAppBase,
            react(),
            visualizer({
                filename: './stats/stats.html',
                open: false,
            }),
            UnpluginInjectPreload({
                files: [
                    {
                        entryMatch: /logo-light.png$/,
                        outputMatch: /logo-light-.*.png$/,
                    },
                    {
                        entryMatch: /logo-dark.png$/,
                        outputMatch: /logo-dark-.*.png$/,
                    },
                ],
            }),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            rollupOptions: {
                external: (id) => /__test__/.test(id),
                output: {
                    assetFileNames: (assetInfo) => {
                        if (
                            assetInfo.names &&
                            assetInfo.originalFileNames.some((name) =>
                                name.startsWith('src/assets/templates/')
                            )
                        ) {
                            return 'assets/[name][extname]';
                        }
                        return 'assets/[name]-[hash][extname]';
                    },
                },
            },
        },
    };
});
