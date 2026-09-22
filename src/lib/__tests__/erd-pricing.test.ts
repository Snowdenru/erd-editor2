import { describe, it, expect } from 'vitest';
import {
    TERMS,
    discountVsMonth,
    formatRub,
    perMonth,
    priceForPeriod,
} from '../erd-pricing';
import type { ErdPlan } from '../sqllab-account';

const plan: ErdPlan = {
    id: 7,
    name: 'ERD Pro',
    price: '290.00',
    duration_days: 30,
    price_7d: '149.00',
    duration_days_7d: 7,
    price_3m: '690.00',
    duration_days_3m: 91,
    price_yearly: '2490.00',
    duration_days_yearly: 365,
};

describe('erd-pricing', () => {
    it('lists four terms in display order', () => {
        expect(TERMS.map((t) => t.period)).toEqual(['7d', '1m', '3m', '12m']);
    });

    it('reads the price for each period from the plan', () => {
        expect(priceForPeriod(plan, '7d')).toBe(149);
        expect(priceForPeriod(plan, '1m')).toBe(290);
        expect(priceForPeriod(plan, '3m')).toBe(690);
        expect(priceForPeriod(plan, '12m')).toBe(2490);
    });

    it('returns null when the plan has no price for the period', () => {
        expect(priceForPeriod({ ...plan, price_7d: null }, '7d')).toBeNull();
    });

    it('computes price per calendar month rounded to a ruble', () => {
        expect(perMonth(690, 3)).toBe(230);
        expect(perMonth(2490, 12)).toBe(208);
        expect(perMonth(290, 1)).toBe(290);
    });

    it('computes discount versus the 30-day price, never negative', () => {
        expect(discountVsMonth(690, 3, 290)).toBe(21);
        expect(discountVsMonth(2490, 12, 290)).toBe(28);
        expect(discountVsMonth(290, 1, 290)).toBe(0);
        expect(discountVsMonth(149, 0, 290)).toBe(0);
    });

    it('formats rubles with a thin group separator', () => {
        expect(formatRub(2490)).toBe('2 490 ₽');
        expect(formatRub(149)).toBe('149 ₽');
    });
});
