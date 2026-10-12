import type { AiDialect } from './types';

export type AiOpenSource =
    | 'landing'
    | 'create_dialog'
    | 'empty_state'
    | 'sidebar'
    | 'resume';

export interface OpenAiGenerateDetail {
    source: AiOpenSource;
    prompt?: string;
    dialect?: AiDialect;
    autostart?: boolean;
}

const EVENT_NAME = 'erd2:open-ai-generate';

export const emitOpenAiGenerate = (detail: OpenAiGenerateDetail): void => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
};

export const onOpenAiGenerate = (
    handler: (detail: OpenAiGenerateDetail) => void
): (() => void) => {
    const listener = (event: Event) =>
        handler((event as CustomEvent<OpenAiGenerateDetail>).detail);
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
