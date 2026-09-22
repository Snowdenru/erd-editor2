import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Loader2 } from 'lucide-react';
import { LocalConfigProvider } from '@/context/local-config-context/local-config-provider';
import { ThemeProvider } from '@/context/theme-context/theme-provider';
import { Button } from '@/components/button/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/accordion/accordion';
import { MarketingHeader } from '@/components/marketing-layout/marketing-header';
import { MarketingFooter } from '@/components/marketing-layout/marketing-footer';
import {
    APP_BASE,
    buildLoginUrl,
    fetchErdPlan,
    fetchLimits,
    initiatePayment,
    isLoggedIn,
    trackEvent,
} from '@/lib/sqllab-account';
import type { BillingPeriod, ErdPlan } from '@/lib/sqllab-account';
import {
    TERMS,
    discountVsMonth,
    formatRub,
    perMonth,
    priceForPeriod,
} from '@/lib/erd-pricing';
import { COMPARE_ROWS, FAQ } from './pricing-content';

const PRICING_PATH = `${APP_BASE}/pricing`;
const SUCCESS_RETURN = `${PRICING_PATH}?payment=success`;
const AUTO_START_KEY = 'erd2_pricing_autostart';
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 8;

const isPeriod = (value: string | null): value is BillingPeriod =>
    TERMS.some((term) => term.period === value);

const PricingPageComponent: React.FC = () => {
    const [searchParams] = useSearchParams();
    const requestedPlan = searchParams.get('plan');
    const paymentSuccess = searchParams.get('payment') === 'success';

    const [plan, setPlan] = useState<ErdPlan | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [period, setPeriod] = useState<BillingPeriod>(
        isPeriod(requestedPlan) ? requestedPlan : '12m'
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [activated, setActivated] = useState(false);
    const autoStarted = useRef(false);

    const loadPlan = useCallback(() => {
        setLoadFailed(false);
        fetchErdPlan()
            .then(setPlan)
            .catch(() => setLoadFailed(true));
    }, []);

    useEffect(() => {
        loadPlan();
        trackEvent('erd2_pricing_view', PRICING_PATH, {
            from_payment: paymentSuccess,
        });
    }, [loadPlan, paymentSuccess]);

    // После возврата из ЮKassa вебхук может прийти с задержкой — перепроверяем уровень несколько раз
    useEffect(() => {
        if (!paymentSuccess || !isLoggedIn()) {
            return;
        }
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            fetchLimits()
                .then((limits) => {
                    if (limits.tier !== 'free') {
                        setActivated(true);
                        clearInterval(timer);
                    }
                })
                .catch(() => undefined);
            if (attempts >= POLL_ATTEMPTS) {
                clearInterval(timer);
            }
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [paymentSuccess]);

    const startCheckout = useCallback(
        async (chosen: BillingPeriod) => {
            if (!plan) {
                return;
            }
            if (!isLoggedIn()) {
                window.location.assign(
                    buildLoginUrl(`${PRICING_PATH}?plan=${chosen}`)
                );
                return;
            }
            setBusy(true);
            setError('');
            trackEvent('erd2_checkout_start', PRICING_PATH, { period: chosen });
            try {
                const url = await initiatePayment(
                    plan.id,
                    chosen,
                    SUCCESS_RETURN
                );
                window.location.assign(url);
            } catch {
                setError('Не удалось начать оплату. Попробуйте ещё раз.');
                setBusy(false);
            }
        },
        [plan]
    );

    // Вернулись со входа с выбранным сроком — сразу к оплате (один раз за сессию вкладки)
    useEffect(() => {
        if (
            !plan ||
            autoStarted.current ||
            !isPeriod(requestedPlan) ||
            paymentSuccess ||
            !isLoggedIn() ||
            sessionStorage.getItem(AUTO_START_KEY) === requestedPlan
        ) {
            return;
        }
        autoStarted.current = true;
        sessionStorage.setItem(AUTO_START_KEY, requestedPlan);
        void startCheckout(requestedPlan);
    }, [plan, requestedPlan, paymentSuccess, startCheckout]);

    const monthPrice = plan ? (priceForPeriod(plan, '1m') ?? 0) : 0;
    const chosenPrice = plan ? priceForPeriod(plan, period) : null;
    const loggedIn = isLoggedIn();

    return (
        <>
            <Helmet>
                <title>Тарифы ERD Pro — SQL Lab ERD</title>
                <meta
                    name="description"
                    content="ERD Pro от 149 ₽: до 100 таблиц в схеме и 25 схем в облаке."
                />
            </Helmet>
            <section className="flex w-screen flex-col overflow-x-hidden bg-background">
                <MarketingHeader />

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                            Тарифы ERD Pro
                        </h1>
                        <p className="max-w-2xl text-lg text-muted-foreground">
                            Больше таблиц и схем в облаке. Платите на срок,
                            который нужен: от недели до года.
                        </p>
                    </div>

                    {paymentSuccess ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-green-600 bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-200">
                            <Check className="size-5 shrink-0" />
                            <div>
                                <p className="font-semibold">Оплата прошла</p>
                                <p className="text-sm">
                                    {activated
                                        ? 'ERD Pro активен. Можно возвращаться в редактор.'
                                        : 'Подключаем ERD Pro — это занимает несколько секунд.'}
                                </p>
                            </div>
                            <Button asChild className="ml-auto">
                                <Link to="/">Открыть редактор</Link>
                            </Button>
                        </div>
                    ) : null}

                    {loadFailed ? (
                        <div className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
                            <p>Не удалось загрузить тарифы.</p>
                            <Button onClick={loadPlan}>Повторить</Button>
                        </div>
                    ) : !plan ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="size-8 animate-spin text-pink-600" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div
                                role="radiogroup"
                                aria-label="Срок"
                                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                            >
                                {TERMS.map((term) => {
                                    const price = priceForPeriod(
                                        plan,
                                        term.period
                                    );
                                    if (price === null) {
                                        return null;
                                    }
                                    const discount = discountVsMonth(
                                        price,
                                        term.months,
                                        monthPrice
                                    );
                                    const selected = period === term.period;
                                    return (
                                        <button
                                            key={term.period}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            aria-label={term.label}
                                            onClick={() =>
                                                setPeriod(term.period)
                                            }
                                            className={`relative flex flex-col items-start gap-1 rounded-2xl border-2 p-5 text-left transition-colors ${
                                                selected
                                                    ? 'border-pink-600 bg-pink-50 dark:bg-pink-950/30'
                                                    : 'hover:border-pink-300'
                                            }`}
                                        >
                                            {term.period === '12m' ? (
                                                <span className="absolute -top-3 right-4 rounded-full bg-pink-600 px-3 py-0.5 text-xs font-semibold text-white">
                                                    Выгоднее всего
                                                </span>
                                            ) : null}
                                            <span className="text-sm text-muted-foreground">
                                                {term.label}
                                            </span>
                                            <span className="text-3xl font-bold">
                                                {formatRub(price)}
                                            </span>
                                            {term.months > 1 ? (
                                                <span className="text-sm text-muted-foreground">
                                                    {formatRub(
                                                        perMonth(
                                                            price,
                                                            term.months
                                                        )
                                                    )}{' '}
                                                    в месяц
                                                    {discount > 0
                                                        ? ` · −${discount}%`
                                                        : ''}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    {term.period === '7d'
                                                        ? 'Сдать проект или диплом'
                                                        : 'Основной вариант'}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <Button
                                    size="lg"
                                    disabled={busy || chosenPrice === null}
                                    onClick={() => void startCheckout(period)}
                                    className="h-12 rounded-xl px-10 text-base"
                                >
                                    {busy ? (
                                        <Loader2 className="mr-2 size-5 animate-spin" />
                                    ) : null}
                                    {loggedIn
                                        ? `Оплатить ${chosenPrice !== null ? formatRub(chosenPrice) : ''}`
                                        : 'Войти и оплатить'}
                                </Button>
                                {error ? (
                                    <p className="text-sm text-destructive">
                                        {error}
                                    </p>
                                ) : null}
                                <p className="text-sm text-muted-foreground">
                                    Оплата картой или через СБП. Вход — через
                                    Яндекс, VK или почту.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto rounded-2xl border">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="p-4 font-semibold">
                                        Возможности
                                    </th>
                                    <th className="p-4 font-semibold">Free</th>
                                    <th className="p-4 font-semibold text-pink-600">
                                        ERD Pro
                                    </th>
                                    <th className="p-4 font-semibold">
                                        Общий Pro
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMPARE_ROWS.map((row) => (
                                    <tr key={row.label} className="border-t">
                                        <td className="p-4 font-medium">
                                            {row.label}
                                        </td>
                                        <td className="p-4 text-muted-foreground">
                                            {row.free}
                                        </td>
                                        <td className="p-4">{row.erd}</td>
                                        <td className="p-4 text-muted-foreground">
                                            {row.pro}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-100/70 p-8 text-center dark:bg-slate-900/40">
                        <h2 className="text-2xl font-bold">
                            Нужны и курсы SQL?
                        </h2>
                        <p className="max-w-xl text-muted-foreground">
                            Общий Pro включает ERD Pro, все курсы, тренажёр и
                            материалы платформы.
                        </p>
                        {/* /plans — страница платформы вне SPA: обычная ссылка, не Link */}
                        <Button asChild variant="outline">
                            <a href="/plans">Смотреть общий Pro</a>
                        </Button>
                    </div>

                    <div className="mx-auto w-full max-w-2xl">
                        <h2 className="mb-4 text-center text-2xl font-bold">
                            Частые вопросы
                        </h2>
                        <Accordion type="single" collapsible>
                            {FAQ.map(({ question, answer }, index) => (
                                <AccordionItem
                                    key={question}
                                    value={`faq-${index}`}
                                >
                                    <AccordionTrigger className="text-left">
                                        {question}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>

                <MarketingFooter />
            </section>
        </>
    );
};

export const PricingPage: React.FC = () => (
    <LocalConfigProvider>
        <ThemeProvider>
            <PricingPageComponent />
        </ThemeProvider>
    </LocalConfigProvider>
);
