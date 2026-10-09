const EVENT_NAME = 'erd2:open-share';

export const emitOpenShare = (): void => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

export const onOpenShare = (handler: () => void): (() => void) => {
    const listener = () => handler();
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
