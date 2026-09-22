import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/sqllab-auth';
import {
    PaymentError,
    buildLoginUrl,
    fetchErdPlan,
    fetchLimits,
    initiatePayment,
    isLoggedIn,
    trackEvent,
} from '../sqllab-account';

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

describe('sqllab-account', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('isLoggedIn follows the access token cookie', () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('t');
        expect(isLoggedIn()).toBe(true);
        vi.spyOn(auth, 'getAccessToken').mockReturnValue(null);
        expect(isLoggedIn()).toBe(false);
    });

    it('buildLoginUrl encodes the return path', () => {
        expect(buildLoginUrl('/tools/erd2/pricing?plan=12m')).toBe(
            '/auth/login?returnUrl=%2Ftools%2Ferd2%2Fpricing%3Fplan%3D12m'
        );
    });

    it('fetchLimits returns the API body', async () => {
        const body = {
            tier: 'free',
            max_tables: 10,
            max_cloud_diagrams: 3,
            cloud_diagrams_used: 1,
        };
        vi.spyOn(auth, 'authFetch').mockResolvedValue(json(body));
        await expect(fetchLimits()).resolves.toEqual(body);
    });

    it('fetchErdPlan takes the first plan from a list', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            json([{ id: 9, name: 'ERD Pro', price: '290.00' }])
        );
        await expect(fetchErdPlan()).resolves.toMatchObject({ id: 9 });
        expect(fetch).toHaveBeenCalledWith('/api/plans/?type=erd');
    });

    it('fetchErdPlan fails when the plan is missing', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([]));
        await expect(fetchErdPlan()).rejects.toThrow();
    });

    it('initiatePayment posts plan, period and return_to, returns the payment url', async () => {
        const spy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(
                json({ confirmation_url: 'https://yookassa.ru/pay/1' })
            );

        const url = await initiatePayment(
            9,
            '12m',
            '/tools/erd2/pricing?payment=success'
        );

        expect(url).toBe('https://yookassa.ru/pay/1');
        const [path, init] = spy.mock.calls[0];
        expect(path).toBe('/api/payment/initiate/');
        expect(JSON.parse(String(init?.body))).toEqual({
            plan_id: 9,
            billing_period: '12m',
            return_to: '/tools/erd2/pricing?payment=success',
        });
    });

    it('initiatePayment throws PaymentError with the status on failure', async () => {
        vi.spyOn(auth, 'authFetch').mockResolvedValue(json({}, 401));
        await expect(
            initiatePayment(9, '1m', '/tools/erd2/')
        ).rejects.toMatchObject({
            name: 'PaymentError',
            status: 401,
        });
        expect(new PaymentError(500, 'x').status).toBe(500);
    });

    it('trackEvent never throws, even when the request fails', () => {
        vi.spyOn(auth, 'authFetch').mockRejectedValue(new Error('offline'));
        expect(() =>
            trackEvent('erd2_wall_view', '/tools/erd2/', { reason: 'x' })
        ).not.toThrow();
    });
});
