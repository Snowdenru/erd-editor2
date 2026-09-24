// src/lib/export-dialog-events.ts
export type ExportTab = 'image' | 'sql' | 'formats';

const EVENT_NAME = 'erd2:open-export';

export const emitOpenExport = (tab: ExportTab = 'image'): void => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: tab }));
};

export const onOpenExport = (
    handler: (tab: ExportTab) => void
): (() => void) => {
    const listener = (event: Event) =>
        handler((event as CustomEvent<ExportTab>).detail);
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
