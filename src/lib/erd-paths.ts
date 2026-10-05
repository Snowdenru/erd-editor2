// Пути внутри SPA (без basename). Целевая структура адресов ERD — см.
// docs/superpowers/specs/2026-09-21-erd-url-structure-design.md в sql-platform.
export const NEW_DIAGRAM_PATH = '/new';
export const DIAGRAMS_PATH = '/diagrams';
export const diagramPath = (id: string): string => `/d/${id}`;
export const templateUsePath = (slug: string): string =>
    `/templates/${slug}/use`;
export const PRICING_PATH = '/pricing';
