import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { diagramPath, templateUsePath } from '@/lib/erd-paths';

// Старый адрес редактора схемы: /diagrams/:id → /d/:id.
export const LegacyDiagramRedirect: React.FC = () => {
    const { diagramId = '' } = useParams<{ diagramId: string }>();
    const { search } = useLocation();
    return (
        <Navigate to={{ pathname: diagramPath(diagramId), search }} replace />
    );
};

// Старый адрес клонирования шаблона: /templates/clone/:slug → /templates/:slug/use.
export const LegacyTemplateCloneRedirect: React.FC = () => {
    const { templateSlug = '' } = useParams<{ templateSlug: string }>();
    return <Navigate to={templateUsePath(templateSlug)} replace />;
};
