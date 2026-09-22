import { authFetch, getAccessToken } from '@/lib/sqllab-auth';

export const APP_BASE = '/tools/erd2';

export type ErdTier = 'free' | 'erd' | 'pro';

export interface ErdLimits {
    tier: ErdTier;
    max_tables: number;
    max_cloud_diagrams: number | null;
    cloud_diagrams_used: number;
}

export type BillingPeriod = '7d' | '1m' | '3m' | '12m';

export interface ErdPlan {
    id: number;
    name: string;
    price: string;
    duration_days: number;
    price_7d: string | null;
    duration_days_7d: number | null;
    price_3m: string | null;
    duration_days_3m: number | null;
    price_yearly: string | null;
    duration_days_yearly: number | null;
}

export class PaymentError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'PaymentError';
        this.status = status;
    }
}

export const isLoggedIn = (): boolean => getAccessToken() !== null;

// Страница входа платформы принимает только внутренний путь, не начинающийся с /auth/
export const buildLoginUrl = (returnPath: string): string =>
    `/auth/login?returnUrl=${encodeURIComponent(returnPath)}`;

export async function fetchLimits(): Promise<ErdLimits> {
    const res = await authFetch('/api/erd2/limits/');
    if (!res.ok) {
        throw new Error(`limits: HTTP ${res.status}`);
    }
    return (await res.json()) as ErdLimits;
}

export async function fetchErdPlan(): Promise<ErdPlan> {
    const res = await fetch('/api/plans/?type=erd');
    if (!res.ok) {
        throw new Error(`plans: HTTP ${res.status}`);
    }
    const data = (await res.json()) as ErdPlan[] | { results?: ErdPlan[] };
    const plan = Array.isArray(data) ? data[0] : data.results?.[0];
    if (!plan) {
        throw new Error('plans: тариф ERD Pro не найден');
    }
    return plan;
}

export async function initiatePayment(
    planId: number,
    billingPeriod: BillingPeriod,
    returnTo: string
): Promise<string> {
    const res = await authFetch('/api/payment/initiate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            plan_id: planId,
            billing_period: billingPeriod,
            return_to: returnTo,
        }),
    });
    if (!res.ok) {
        throw new PaymentError(res.status, `payment: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { confirmation_url?: string };
    if (!data.confirmation_url) {
        throw new PaymentError(res.status, 'payment: нет confirmation_url');
    }
    return data.confirmation_url;
}

export type FunnelEvent =
    | 'erd2_pricing_view'
    | 'erd2_checkout_start'
    | 'erd2_wall_view'
    | 'erd2_login_prompt';

// Аналитика не должна ломать интерфейс: любые ошибки глотаем
export function trackEvent(
    eventType: FunnelEvent,
    page: string,
    payload: Record<string, unknown> = {}
): void {
    try {
        void authFetch('/api/auth/event/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: eventType,
                page,
                payload,
                session_id: '',
            }),
        }).catch(() => undefined);
    } catch {
        // ignore
    }
}
