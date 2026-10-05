import type { LockedCard } from '@/lib/cloud-diagrams';

// Закрытые облачные схемы текущей загрузки страницы. Заполняет CloudPullProvider,
// читают список «Мои схемы» и экран /d/<id>. В IndexedDB не пишем: на сервере у них нет content.
let cards: LockedCard[] = [];
const EVENT_NAME = 'erd2:locked-cards';

export const getLockedCards = (): LockedCard[] => cards;

export const setLockedCards = (next: LockedCard[]): void => {
    cards = next;
    window.dispatchEvent(new Event(EVENT_NAME));
};

export const subscribeLockedCards = (handler: () => void): (() => void) => {
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
};
