// Единый источник адреса приложения и флага индексации лендинга.
// По умолчанию — прежнее поведение (/tools/erd2, лендинг закрыт от индексации).
const rawBase = import.meta.env.VITE_APP_BASE as string | undefined;

export const APP_BASE: string =
    (rawBase ?? '').trim().replace(/\/+$/, '') || '/tools/erd2';

export const ABOUT_INDEXABLE: boolean =
    import.meta.env.VITE_ABOUT_INDEXABLE === 'true';

// path начинается с '/'; пустой path даёт корень приложения со слэшем
export const appUrl = (path: string): string => `${APP_BASE}${path || '/'}`;
