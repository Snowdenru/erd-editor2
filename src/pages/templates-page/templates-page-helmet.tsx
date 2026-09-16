import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { HOST_URL } from '@/lib/env';

export interface TemplatesPageHelmetProps {
    tag?: string;
    isFeatured: boolean;
}

export const TemplatesPageHelmet: React.FC<TemplatesPageHelmetProps> = ({
    tag,
    isFeatured,
}) => {
    const { tag: tagParam } = useParams<{ tag: string }>();

    return (
        <Helmet>
            {tag ? (
                <title>{`${tag} database schema diagram templates | SQL Lab`}</title>
            ) : isFeatured ? (
                <title>
                    Featured database schema diagram templates | SQL Lab
                </title>
            ) : (
                <title>Database schema diagram templates | SQL Lab</title>
            )}

            {tag ? (
                <meta
                    name="description"
                    content={`Discover a collection of real-world database schema diagrams for ${tag}, featuring example applications and popular open-source projects.`}
                />
            ) : (
                <meta
                    name="description"
                    content="Discover a collection of real-world database schema diagrams, featuring example applications and popular open-source projects."
                />
            )}

            {tag ? (
                <meta
                    property="og:title"
                    content={`${tag} database schema diagram templates | SQL Lab`}
                />
            ) : isFeatured ? (
                <meta
                    property="og:title"
                    content="Featured database schema diagram templates | SQL Lab"
                />
            ) : (
                <meta
                    property="og:title"
                    content="Database schema diagram templates | SQL Lab"
                />
            )}

            {tag ? (
                <meta
                    property="og:url"
                    content={`${HOST_URL}/templates/${tagParam}`}
                />
            ) : isFeatured ? (
                <meta
                    property="og:url"
                    content={`${HOST_URL}/templates/featured`}
                />
            ) : (
                <meta property="og:url" content={`${HOST_URL}/templates`} />
            )}

            {tag ? (
                <meta
                    property="og:description"
                    content={`Discover a collection of real-world database schema diagrams for ${tag}, featuring example applications and popular open-source projects.`}
                />
            ) : (
                <meta
                    property="og:description"
                    content="Discover a collection of real-world database schema diagrams, featuring example applications and popular open-source projects."
                />
            )}
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="SQL Lab" />

            {tag ? (
                <meta
                    name="twitter:title"
                    content={`${tag} database schema diagram templates | SQL Lab`}
                />
            ) : (
                <meta
                    name="twitter:title"
                    content="Database schema diagram templates | SQL Lab"
                />
            )}

            {tag ? (
                <meta
                    name="twitter:description"
                    content={`Discover a collection of real-world database schema diagrams for ${tag}, featuring example applications and popular open-source projects.`}
                />
            ) : (
                <meta
                    name="twitter:description"
                    content="Discover a collection of real-world database schema diagrams, featuring example applications and popular open-source projects."
                />
            )}

            <meta name="twitter:card" content="summary_large_image" />
        </Helmet>
    );
};
