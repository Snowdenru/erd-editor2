import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ABOUT_INDEXABLE, APP_BASE } from '@/lib/app-config';

// Флаг VITE_ABOUT_INDEXABLE (по умолчанию false) — страница закрыта от индексации (noindex);
// canonical указывает на корень приложения — лендинг отдаётся на корне и на /about.
// После переезда на /tools/erd включить сборкой с VITE_ABOUT_INDEXABLE=true.
export { ABOUT_INDEXABLE };

const SITE = 'https://sqllab.ru';
const TITLE = 'ERD онлайн: бесплатный редактор ER-диаграмм — SQL Lab';
const DESCRIPTION =
    'Бесплатный онлайн-редактор ER-диаграмм: вставьте DDL или SQL — получите схему за секунды. PostgreSQL, MySQL, SQLite, Oracle. Экспорт в SQL, PNG, SVG, DBML.';
const OG_IMAGE = `${SITE}/og/erd-tool.png`;

export interface AboutSeoProps {
    faqItems: Array<{ question: string; answer: string }>;
}

export const AboutSeo: React.FC<AboutSeoProps> = ({ faqItems }) => {
    const url = ABOUT_INDEXABLE ? `${SITE}${APP_BASE}` : `${SITE}${APP_BASE}/`;

    const softwareApplication = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'ERD онлайн — SQL Lab',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        description: DESCRIPTION,
        url,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
    };

    const faqPage = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    };

    return (
        <Helmet>
            <title>{TITLE}</title>
            <meta name="description" content={DESCRIPTION} />
            <meta
                name="robots"
                content={ABOUT_INDEXABLE ? 'index, follow' : 'noindex, follow'}
            />
            <link rel="canonical" href={url} />
            <meta property="og:title" content={TITLE} />
            <meta property="og:description" content={DESCRIPTION} />
            <meta property="og:type" content="website" />
            <meta property="og:url" content={url} />
            <meta property="og:image" content={OG_IMAGE} />
            <meta property="og:locale" content="ru_RU" />
            <meta property="og:site_name" content="SQL Lab" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={TITLE} />
            <meta name="twitter:description" content={DESCRIPTION} />
            <meta name="twitter:image" content={OG_IMAGE} />
            <script type="application/ld+json">
                {JSON.stringify(softwareApplication)}
            </script>
            <script type="application/ld+json">
                {JSON.stringify(faqPage)}
            </script>
        </Helmet>
    );
};
