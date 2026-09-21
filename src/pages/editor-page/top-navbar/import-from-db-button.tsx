import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useDialog } from '@/hooks/use-dialog';

export const ImportFromDbButton: React.FC = () => {
    const { t } = useTranslation();
    const { openCreateDiagramDialog } = useDialog();

    return (
        <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => openCreateDiagramDialog()}
        >
            <Database className="mr-1.5 size-4" />
            {t('canvas_empty_state.import_from_database')}
        </Button>
    );
};
