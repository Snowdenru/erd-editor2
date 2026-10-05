import { useSyncExternalStore } from 'react';
import type { LockedCard } from '@/lib/cloud-diagrams';
import { getLockedCards, subscribeLockedCards } from '@/lib/locked-diagrams';

export const useLockedCards = (): LockedCard[] =>
    useSyncExternalStore(subscribeLockedCards, getLockedCards);
