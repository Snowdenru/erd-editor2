// src/components/export-dialog/export-host.tsx
import React, { useEffect, useState } from 'react';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { useLoginGate } from '@/hooks/use-login-gate';
import { onOpenExport, type ExportTab } from '@/lib/export-dialog-events';
import { ExportDialog } from './export-dialog';

export const ExportHost: React.FC = () => {
    const { guard, promptOpen, setPromptOpen } = useLoginGate();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<ExportTab>('image');
    // Новый ключ при каждом открытии, чтобы окно стартовало на запрошенной вкладке
    const [openCount, setOpenCount] = useState(0);

    useEffect(
        () =>
            onOpenExport((requested) => {
                if (!guard()) {
                    return;
                }
                setTab(requested);
                setOpenCount((count) => count + 1);
                setOpen(true);
            }),
        [guard]
    );

    return (
        <>
            <ExportDialog
                key={openCount}
                open={open}
                onOpenChange={setOpen}
                initialTab={tab}
            />
            <LoginPromptDialog
                open={promptOpen}
                onOpenChange={setPromptOpen}
                reason="export"
                returnPath={`${window.location.pathname}${window.location.search}`}
            />
        </>
    );
};
