export type UpgradeReason = 'diagram_limit' | 'table_limit';

export interface UpgradeWallDetail {
    reason: UpgradeReason;
    limit?: number;
}

const EVENT_NAME = 'erd2:upgrade-wall';

export const emitUpgradeWall = (detail: UpgradeWallDetail): void => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
};

export const onUpgradeWall = (
    handler: (detail: UpgradeWallDetail) => void
): (() => void) => {
    const listener = (event: Event) =>
        handler((event as CustomEvent<UpgradeWallDetail>).detail);
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
