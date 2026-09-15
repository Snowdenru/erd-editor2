import React from 'react';

const REPO_URL = 'https://github.com/Snowdenru/erd-editor2';

export const SourceLink: React.FC = () => (
    <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:underline"
    >
        Исходный код
    </a>
);
