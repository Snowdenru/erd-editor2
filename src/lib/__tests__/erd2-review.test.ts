import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/sqllab-auth';
import {
    canAutoPrompt,
    fetchMyReview,
    markPromptDismissed,
    markReviewed,
    submitReview,
    tagsForRating,
    REVIEW_TAGS,
} from '../erd2-review';

describe('tagsForRating', () => {
    it('picks a tag set by rating band', () => {
        expect(tagsForRating(1)).toBe(REVIEW_TAGS.low);
        expect(tagsForRating(2)).toBe(REVIEW_TAGS.low);
        expect(tagsForRating(3)).toBe(REVIEW_TAGS.mid);
        expect(tagsForRating(4)).toBe(REVIEW_TAGS.high);
        expect(tagsForRating(5)).toBe(REVIEW_TAGS.high);
    });
});

describe('auto prompt schedule', () => {
    beforeEach(() => localStorage.clear());
    const DAY = 24 * 60 * 60 * 1000;

    it('allows the first prompt', () => {
        expect(canAutoPrompt(1_000)).toBe(true);
    });
    it('is suppressed for 30 days after dismissal', () => {
        markPromptDismissed(0);
        expect(canAutoPrompt(29 * DAY)).toBe(false);
        expect(canAutoPrompt(31 * DAY)).toBe(true);
    });
    it('is suppressed forever after a review', () => {
        markReviewed();
        expect(canAutoPrompt(1000 * DAY)).toBe(false);
    });
});

describe('api', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('fetchMyReview returns the review or null', async () => {
        const spy = vi.spyOn(auth, 'authFetch');
        spy.mockResolvedValueOnce(
            new Response(JSON.stringify({ review: null }), { status: 200 })
        );
        expect(await fetchMyReview()).toBeNull();
        spy.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    review: {
                        rating: 4,
                        tags: ['Быстро'],
                        text: 'ок',
                        updated_at: '2026-09-24',
                    },
                }),
                { status: 200 }
            )
        );
        expect(await fetchMyReview()).toEqual({
            rating: 4,
            tags: ['Быстро'],
            text: 'ок',
        });
    });

    it('submitReview posts to the erd2 endpoint and throws on failure', async () => {
        const spy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response('{}', { status: 201 }));
        await submitReview({ rating: 5, tags: ['Быстро'], text: '' });
        expect(spy.mock.calls[0][0]).toBe('/api/reviews/tool/erd2/');
        expect(
            JSON.parse(String((spy.mock.calls[0][1] as RequestInit).body))
        ).toEqual({ rating: 5, tags: ['Быстро'], text: '' });

        spy.mockResolvedValue(new Response('{}', { status: 400 }));
        await expect(
            submitReview({ rating: 5, tags: [], text: '' })
        ).rejects.toThrow();
    });
});
