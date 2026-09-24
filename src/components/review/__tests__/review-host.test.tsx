import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import * as review from '@/lib/erd2-review';
import { emitReviewSignal } from '@/lib/review-events';
import { ReviewHost } from '../review-host';

describe('ReviewHost', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.restoreAllMocks();
        localStorage.clear();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        vi.spyOn(review, 'fetchMyReview').mockResolvedValue(null);
    });
    afterEach(() => vi.useRealTimers());

    it('opens the rating dialog for a logged-in user on the open signal', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ReviewHost />);
        act(() => emitReviewSignal('open'));
        expect(screen.getByText('Оцените ERD-редактор')).toBeInTheDocument();
    });

    it('asks an anonymous user to sign in instead', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        render(<ReviewHost />);
        act(() => emitReviewSignal('open'));
        expect(
            screen.getByText('Оценить редактор могут вошедшие')
        ).toBeInTheDocument();
        expect(screen.queryByText('Оцените ERD-редактор')).toBeNull();
    });

    it('nudges a logged-in user after five minutes and tracks the prompt', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ReviewHost />);
        expect(screen.queryByText('Как вам редактор?')).toBeNull();
        act(() => {
            vi.advanceTimersByTime(5 * 60_000);
        });
        expect(screen.getByText('Как вам редактор?')).toBeInTheDocument();
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_review_prompt',
            expect.any(String),
            { action: 'shown' }
        );
    });

    it('does not nudge anonymous users on the timer', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(false);
        render(<ReviewHost />);
        act(() => {
            vi.advanceTimersByTime(10 * 60_000);
        });
        expect(screen.queryByText('Как вам редактор?')).toBeNull();
    });

    it('does not nudge when the prompt was dismissed recently', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        review.markPromptDismissed(Date.now());
        render(<ReviewHost />);
        act(() => {
            vi.advanceTimersByTime(5 * 60_000);
        });
        expect(screen.queryByText('Как вам редактор?')).toBeNull();
    });

    it('closing the nudge stores the dismissal and tracks it', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ReviewHost />);
        act(() => emitReviewSignal('nudge'));
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
        expect(screen.queryByText('Как вам редактор?')).toBeNull();
        expect(review.canAutoPrompt()).toBe(false);
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_review_prompt',
            expect.any(String),
            { action: 'dismissed' }
        );
    });

    it('accepting the nudge opens the dialog', () => {
        vi.spyOn(account, 'isLoggedIn').mockReturnValue(true);
        render(<ReviewHost />);
        act(() => emitReviewSignal('nudge'));
        fireEvent.click(screen.getByRole('button', { name: 'Оценить' }));
        expect(screen.getByText('Оцените ERD-редактор')).toBeInTheDocument();
    });
});
