import type { BillingPeriod, ErdPlan } from '@/lib/sqllab-account';

export interface Term {
    period: BillingPeriod;
    label: string;
    days: number;
    // Календарные месяцы для цены «в месяц» (7 дней → 0)
    months: number;
}

export const TERMS: Term[] = [
    { period: '7d', label: '7 дней', days: 7, months: 0 },
    { period: '1m', label: '30 дней', days: 30, months: 1 },
    { period: '3m', label: '3 месяца', days: 91, months: 3 },
    { period: '12m', label: '12 месяцев', days: 365, months: 12 },
];

export function priceForPeriod(
    plan: ErdPlan,
    period: BillingPeriod
): number | null {
    const raw = {
        '7d': plan.price_7d,
        '1m': plan.price,
        '3m': plan.price_3m,
        '12m': plan.price_yearly,
    }[period];
    return raw === null || raw === undefined ? null : Number(raw);
}

export const perMonth = (price: number, months: number): number =>
    Math.round(price / months);

export function discountVsMonth(
    price: number,
    months: number,
    monthPrice: number
): number {
    if (months <= 1) {
        return 0;
    }
    return Math.max(
        0,
        Math.round((1 - perMonth(price, months) / monthPrice) * 100)
    );
}

export const formatRub = (value: number): string =>
    `${Math.round(value).toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`;
