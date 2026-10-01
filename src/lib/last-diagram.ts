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

// Операция «удалить и снова добавить ту же схему» (updateDiagramData) стирает маркер через
// storage.deleteDiagram. Запоминаем маркер до операции и возвращаем его после успеха.
export async function keepLastDiagramMarker(
    id: string,
    op: () => Promise<void>
): Promise<void> {
    const wasLast = getLastDiagramId() === id;
    await op();
    if (wasLast) {
        setLastDiagramId(id);
    }
}
