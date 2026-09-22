import React from 'react';
import { Helmet } from 'react-helmet-async';

export const HelmetData: React.FC = () => (
    <Helmet>
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta
            name="description"
            content="Free and Open-source database diagrams editor, visualize and design your database with a single query. Tool to help you draw your DB relationship diagrams and export DDL scripts."
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="SQL Lab - ERD редактор баз данных" />
        <meta
            property="og:description"
            content="Free and Open-source database diagrams editor, visualize and design your database with a single query. Tool to help you draw your DB relationship diagrams and export DDL scripts."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
            name="twitter:title"
            content="SQL Lab - ERD редактор баз данных"
        />
        <meta
            name="twitter:description"
            content="Free and Open-source database diagrams editor, visualize and design your database with a single query. Tool to help you draw your DB relationship diagrams and export DDL scripts."
        />
        <title>SQL Lab - ERD редактор баз данных</title>
    </Helmet>
);
