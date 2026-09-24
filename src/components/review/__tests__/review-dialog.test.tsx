import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import * as account from '@/lib/sqllab-account';
import * as review from '@/lib/erd2-review';
import { ReviewDialog } from '../review-dialog';

// Дожидаемся подгрузки прежнего отзыва, чтобы её setState не выходил за act
const renderDialog = async (onOpenChange = vi.fn()) => {
    render(<ReviewDialog open onOpenChange={onOpenChange} />);
    await act(async () => undefined);
};

describe('ReviewDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        vi.spyOn(account, 'trackEvent').mockImplementation(() => undefined);
        vi.spyOn(review, 'fetchMyReview').mockResolvedValue(null);
        vi.spyOn(review, 'submitReview').mockResolvedValue(undefined);
    });

    it('goes stars -> tags -> comment and submits everything', async () => {
        await renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Оценка 5 из 5' }));

        expect(screen.getByText('Что понравилось?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Быстро' }));
        fireEvent.change(screen.getByPlaceholderText('Ваш вариант...'), {
            target: { value: 'Тёмная тема' },
        });
        fireEvent.click(screen.getByRole('button', { name: /далее/i }));

        fireEvent.change(
            screen.getByPlaceholderText('Пожелания, предложения...'),
            {
                target: { value: 'Спасибо' },
            }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

        await waitFor(() =>
            expect(review.submitReview).toHaveBeenCalledWith({
                rating: 5,
                tags: ['Быстро', 'Тёмная тема'],
                text: 'Спасибо',
            })
        );
        expect(account.trackEvent).toHaveBeenCalledWith(
            'erd2_review_submit',
            expect.any(String),
            { rating: 5, tags_count: 2, has_text: true }
        );
        expect(localStorage.getItem('erd2_review_done')).toBe('1');
    });

    it('shows the low-rating tag set and the matching question', async () => {
        await renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Оценка 1 из 5' }));
        expect(screen.getByText('Что пошло не так?')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Баги или зависания' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Быстро' })).toBeNull();
    });

    it('toggles a tag off on the second click', async () => {
        await renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Оценка 4 из 5' }));
        const tag = screen.getByRole('button', { name: 'Быстро' });
        fireEvent.click(tag);
        fireEvent.click(tag);
        fireEvent.click(screen.getByRole('button', { name: /далее/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
        await waitFor(() =>
            expect(review.submitReview).toHaveBeenCalledWith({
                rating: 4,
                tags: [],
                text: '',
            })
        );
    });

    it('shows an error and keeps the form when submit fails', async () => {
        vi.spyOn(review, 'submitReview').mockRejectedValue(new Error('boom'));
        await renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Оценка 3 из 5' }));
        fireEvent.click(screen.getByRole('button', { name: /далее/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
        expect(
            await screen.findByText(/не удалось отправить/i)
        ).toBeInTheDocument();
        expect(localStorage.getItem('erd2_review_done')).toBeNull();
    });

    it('preloads the previous review so it can be edited', async () => {
        vi.spyOn(review, 'fetchMyReview').mockResolvedValue({
            rating: 2,
            tags: ['Медленно'],
            text: 'старый',
        });
        await renderDialog();
        await waitFor(() =>
            expect(screen.getByText(/ваша оценка/i)).toBeInTheDocument()
        );
        expect(
            screen.getByRole('button', { name: 'Медленно' })
        ).toBeInTheDocument();
    });
});
