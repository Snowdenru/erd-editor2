// src/components/export-dialog/embed-tab.tsx
import React from 'react';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/button/button';
import { emitOpenShare } from '@/lib/share-dialog-events';

export interface EmbedTabProps {
    onClose: () => void;
}

export const EmbedTab: React.FC<EmbedTabProps> = ({ onClose }) => {
    const handleOpen = () => {
        onClose();
        emitOpenShare();
    };

    return (
        <div className="flex flex-1 flex-col items-start gap-4 pt-2">
            <p className="max-w-xl text-sm text-muted-foreground">
                Встройте живую схему на свой сайт или в документацию: посетители
                смотрят её на холсте, двигают и масштабируют, но не меняют.
                Схема должна быть в облаке, а публичный доступ включается с Pro.
            </p>
            <Button onClick={handleOpen}>
                <Code2 className="mr-2 size-4" />
                Получить ссылку и код для встраивания
            </Button>
        </div>
    );
};
