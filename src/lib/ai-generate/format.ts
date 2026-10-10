export function countCreateTables(ddl: string): number {
    return (ddl.match(/create\s+table/gi) ?? []).length;
}

const TITLE_MAX = 40;

export function titleFromPrompt(prompt: string): string {
    const firstLine = prompt.trim().split('\n')[0]?.trim() ?? '';
    return firstLine ? firstLine.slice(0, TITLE_MAX) : 'Схема от ИИ';
}

export function pluralTables(n: number): string {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return `${n} таблиц`;
    if (mod10 === 1) return `${n} таблица`;
    if (mod10 >= 2 && mod10 <= 4) return `${n} таблицы`;
    return `${n} таблиц`;
}
