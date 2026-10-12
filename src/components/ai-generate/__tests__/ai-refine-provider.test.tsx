import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useAiRefine = vi.hoisted(() =>
    vi.fn(() => ({ proposal: { generationId: 'g1' } }))
);
vi.mock('../use-ai-refine', () => ({ useAiRefine }));

import { AiRefineProvider } from '../ai-refine-provider';
import { useAiRefineContext } from '../ai-refine-context';

const Consumer: React.FC = () => (
    <p>
        {
            (
                useAiRefineContext() as unknown as {
                    proposal: { generationId: string };
                }
            ).proposal.generationId
        }
    </p>
);

const Section: React.FC = () => {
    const [shown, setShown] = useState(true);
    return (
        <>
            <button onClick={() => setShown((v) => !v)}>toggle</button>
            {shown ? <Consumer /> : null}
        </>
    );
};

describe('AiRefineProvider', () => {
    it('creates the state once: remounting the section keeps the proposal', () => {
        render(
            <AiRefineProvider>
                <Section />
            </AiRefineProvider>
        );
        fireEvent.click(screen.getByText('toggle'));
        expect(screen.queryByText('g1')).toBeNull();
        fireEvent.click(screen.getByText('toggle'));
        expect(screen.getByText('g1')).toBeTruthy();
    });

    it('fails loudly outside of the provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Consumer />)).toThrow(/AiRefineProvider/);
        spy.mockRestore();
    });
});
