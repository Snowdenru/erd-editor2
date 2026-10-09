import React, { useEffect, useState } from 'react';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { useLoginGate } from '@/hooks/use-login-gate';
import { useChartDB } from '@/hooks/use-chartdb';
import { onOpenShare } from '@/lib/share-dialog-events';
import { ShareDialog } from './share-dialog';

export const ShareHost: React.FC = () => {
    const { guard, promptOpen, setPromptOpen } = useLoginGate();
    const { diagramId } = useChartDB();
    const [open, setOpen] = useState(false);
    const [openCount, setOpenCount] = useState(0);

    useEffect(
        () =>
            onOpenShare(() => {
                if (!guard()) {
                    return;
                }
                setOpenCount((count) => count + 1);
                setOpen(true);
            }),
        [guard]
    );

    return (
        <>
            <ShareDialog
                key={openCount}
                open={open}
                onOpenChange={setOpen}
                diagramId={diagramId}
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
