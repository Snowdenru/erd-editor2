import { authFetch, getAccessToken } from '@/lib/sqllab-auth';
import { getSessionId } from '@/lib/erd2-session';
import { APP_BASE } from '@/lib/app-config';

export { APP_BASE };

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
    | 'erd2_login_prompt'
    | 'erd2_try_pro_click'
    | 'erd2_open'
    | 'erd2_engaged'
    | 'erd2_action'
    | 'erd2_schema_snapshot'
    | 'erd2_export'
    | 'erd2_review_prompt'
    | 'erd2_review_submit';

// Аналитика выключена при предрендере, при редиректе быстрого входа и при ручном флаге erd2_no_track=1
// (для smoke-проверок и ручных прогонов, чтобы не портить статистику).
function isTrackingDisabled(): boolean {
    const w = window as {
        __ERD2_PRERENDER__?: boolean;
        __ERD2_REDIRECTING__?: boolean;
    };
    // __ERD2_REDIRECTING__ ставит скрипт erd2-entry: страница уходит на последнюю схему,
    // лендинг не должен засчитываться как просмотр.
    if (w.__ERD2_PRERENDER__ || w.__ERD2_REDIRECTING__) {
        return true;
    }
    try {
        return localStorage.getItem('erd2_no_track') === '1';
    } catch {
        return false;
    }
}

// Аналитика не должна ломать интерфейс: любые ошибки глотаем
export function trackEvent(
    eventType: FunnelEvent,
    page: string,
    payload: Record<string, unknown> = {},
    options: { keepalive?: boolean } = {}
): void {
    if (isTrackingDisabled()) {
        return;
    }
    try {
        void authFetch('/api/auth/event/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: eventType,
                page,
                payload,
                session_id: getSessionId(),
            }),
            keepalive: options.keepalive ?? false,
        }).catch(() => undefined);
    } catch {
        // ignore
    }
}

const VISITOR_KEY = '_vid';

// Тот же анонимный id посетителя, что у основного сайта (localStorage на общем origin sqllab.ru):
// уникальные посетители не задваиваются при переходе между сайтом и ERD2.
export function getVisitorId(): string {
    try {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id) {
            id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    } catch {
        return '';
    }
}

// Просмотр страницы в общий счётчик платформы (/admin-dashboard/analytics → «Посещения страниц»).
// Ботов отсеивает бэкенд. Ошибки глотаем — аналитика не должна ломать страницу.
export function trackPageView(path: string): void {
    if (isTrackingDisabled()) {
        return;
    }
    try {
        const utmSource = new URLSearchParams(window.location.search).get(
            'utm_source'
        );
        void authFetch('/api/auth/pageview/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_id: getVisitorId(),
                utm_source: utmSource ?? '',
                path,
                session_id: getSessionId(),
            }),
        }).catch(() => undefined);
    } catch {
        // ignore
    }
}

export interface UserProfileSummary {
    full_name: string;
    email: string;
}

export async function fetchProfile(): Promise<UserProfileSummary> {
    const res = await authFetch('/api/auth/profile/');
    if (!res.ok) {
        throw new Error(`profile: HTTP ${res.status}`);
    }
    return (await res.json()) as UserProfileSummary;
}
