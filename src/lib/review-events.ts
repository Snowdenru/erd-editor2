// 'open' — открыть окно оценки, 'nudge' — показать ненавязчивое приглашение оценить.
export type ReviewSignal = 'open' | 'nudge';

const EVENT_NAME = 'erd2:review';

export const emitReviewSignal = (signal: ReviewSignal): void => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: signal }));
};

export const onReviewSignal = (
    handler: (signal: ReviewSignal) => void
): (() => void) => {
    const listener = (event: Event) =>
        handler((event as CustomEvent<ReviewSignal>).detail);
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
