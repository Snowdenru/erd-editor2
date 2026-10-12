import { createContext, useContext } from 'react';
import type { AiRefineApi } from './use-ai-refine';

export const AiRefineContext = createContext<AiRefineApi | null>(null);

export const useAiRefineContext = (): AiRefineApi => {
    const ai = useContext(AiRefineContext);
    if (!ai) {
        throw new Error(
            'useAiRefineContext must be used within AiRefineProvider'
        );
    }
    return ai;
};
