import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { DIAGRAMS_PATH, diagramPath, templateUsePath } from '@/lib/erd-paths';

// «/» теперь — это «/diagrams» (продолжить с последней схемы или выбрать). Query нужен
// глубоким ссылкам лендинга: ?open=import, ?tab=ddl.
export const RedirectToDiagrams: React.FC = () => {
    const { search, hash } = useLocation();
    return <Navigate to={{ pathname: DIAGRAMS_PATH, search, hash }} replace />;
};

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
