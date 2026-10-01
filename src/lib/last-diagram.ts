// Синхронный маркер «последняя открытая схема». Настоящий источник правды — config в IndexedDB
// (асинхронный), а скрипт в index.html должен решить, куда вести пользователя, до отрисовки.
export const LAST_DIAGRAM_KEY = 'erd2_last_diagram';

export function getLastDiagramId(): string {
    try {
        return localStorage.getItem(LAST_DIAGRAM_KEY) ?? '';
    } catch {
        return '';
    }
}

export function setLastDiagramId(id: string): void {
    try {
        if (id) {
            localStorage.setItem(LAST_DIAGRAM_KEY, id);
        } else {
            localStorage.removeItem(LAST_DIAGRAM_KEY);
        }
    } catch {
        // localStorage недоступен — просто без быстрого входа
    }
}

export function clearLastDiagramIfMatches(id: string): void {
    if (getLastDiagramId() === id) {
        setLastDiagramId('');
    }
}
