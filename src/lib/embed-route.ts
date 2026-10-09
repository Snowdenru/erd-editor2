// Страница встраивания /v/<id>/embed (под базой приложения): баннер cookie поверх чужого сайта не нужен.
export const EMBED_PATH_RE = /\/v\/[^/]+\/embed\/?$/;

export const isEmbedPath = (pathname: string): boolean =>
    EMBED_PATH_RE.test(pathname);
