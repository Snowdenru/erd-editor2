import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AboutSeo } from '../about-seo';
import { AboutPage } from '../about-page';

vi.mock('@/lib/sqllab-account', () => ({ trackPageView: vi.fn() }));

const renderSeo = async () => {
    render(
        <HelmetProvider>
            <AboutSeo faqItems={[{ question: 'Q1', answer: 'A1' }]} />
        </HelmetProvider>
    );
    await waitFor(() => expect(document.title).toContain('ERD'));
};

const meta = (sel: string) =>
    document.head.querySelector(`meta[${sel}]`)?.getAttribute('content');

describe('AboutSeo', () => {
    it('renders specific title, noindex robots and canonical', async () => {
        await renderSeo();
        expect(document.title).not.toBe('SQL Lab - ERD редактор баз данных');
        expect(meta('name="robots"')).toBe('noindex, follow');
        expect(
            document.head
                .querySelector('link[rel="canonical"]')
                ?.getAttribute('href')
        ).toBe('https://sqllab.ru/tools/erd2/about');
    });

    it('renders Open Graph and Twitter tags', async () => {
        await renderSeo();
        expect(meta('property="og:type"')).toBe('website');
        expect(meta('property="og:image"')).toBe(
            'https://sqllab.ru/og/erd-tool.png'
        );
        expect(meta('property="og:locale"')).toBe('ru_RU');
        expect(meta('property="og:site_name"')).toBe('SQL Lab');
        expect(meta('name="twitter:card"')).toBeTruthy();
    });

    it('renders valid SoftwareApplication and FAQPage JSON-LD', async () => {
        await renderSeo();
        const jsons = Array.from(
            document.head.querySelectorAll('script[type="application/ld+json"]')
        ).map((el) => JSON.parse(el.textContent ?? ''));
        const faq = jsons.find((j) => j['@type'] === 'FAQPage');
        expect(faq.mainEntity[0].name).toBe('Q1');
        expect(faq.mainEntity[0].acceptedAnswer.text).toBe('A1');
        const app = jsons.find((j) => j['@type'] === 'SoftwareApplication');
        expect(app.applicationCategory).toBe('DeveloperApplication');
        expect(app.offers.price).toBe('0');
    });
});

describe('AboutPage markup', () => {
    it('has exactly one h1 and every img has a non-empty alt', () => {
        const { getAllByRole, container } = render(
            <HelmetProvider>
                <MemoryRouter
                    basename="/tools/erd2"
                    initialEntries={['/tools/erd2/about']}
                >
                    <AboutPage />
                </MemoryRouter>
            </HelmetProvider>
        );
        expect(getAllByRole('heading', { level: 1 })).toHaveLength(1);
        const imgs = Array.from(container.querySelectorAll('img'));
        expect(imgs.length).toBeGreaterThan(0);
        imgs.forEach((img) => {
            expect(img.getAttribute('alt')?.trim()).toBeTruthy();
        });
    });
});
