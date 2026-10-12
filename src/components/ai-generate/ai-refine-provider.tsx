import React from 'react';
import { AiRefineContext } from './ai-refine-context';
import { useAiRefine } from './use-ai-refine';

// Состояние ИИ-проверки живёт выше сайдбара: смена раздела (в том числе по клику на холсте)
// не должна терять открытое предложение и снимок для отката
export const AiRefineProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const ai = useAiRefine();
    return (
        <AiRefineContext.Provider value={ai}>
            {children}
        </AiRefineContext.Provider>
    );
};
