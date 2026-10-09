import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type * as PublicShare from '@/lib/public-share';
import type * as SqllabAccount from '@/lib/sqllab-account';

vi.mock('@/lib/public-share', async (importOriginal) => {
    const actual = await importOriginal<typeof PublicShare>();
    return { ...actual, getShareState: vi.fn(), updateShare: vi.fn() };
});
vi.mock('@/lib/sqllab-account', async (importOriginal) => {
    const actual = await importOriginal<typeof SqllabAccount>();
    return { ...actual, trackEvent: vi.fn() };
});

import { getShareState, updateShare } from '@/lib/public-share';
import { trackEvent } from '@/lib/sqllab-account';
import { ShareDialog } from '../share-dialog';

const free = {
    is_public: false,
    public_theme: 'light',
    grace_until: null,
    can_share: false,
};
const pro = { ...free, can_share: true };

const open = (retryDelayMs?: number) =>
    render(
        <ShareDialog
            open
            onOpenChange={() => undefined}
            diagramId="d1"
            retryDelayMs={retryDelayMs}
        />
    );

describe('ShareDialog', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('без Pro показывает стену и событие, переключателя нет', async () => {
        vi.mocked(getShareState).mockResolvedValue(free as never);
        open();
        expect(await screen.findByText(/доступны с Pro/)).toBeTruthy();
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_share_wall_view',
            expect.any(String),
            {}
        );
        expect(screen.queryByRole('switch')).toBeNull();
    });

    it('с Pro включение вызывает updateShare и показывает ссылку и iframe', async () => {
        vi.mocked(getShareState).mockResolvedValue(pro as never);
        vi.mocked(updateShare).mockResolvedValue({
            ok: true,
            state: { ...pro, is_public: true },
        } as never);
        open();
        fireEvent.click(await screen.findByRole('switch'));
        await waitFor(() =>
            expect(updateShare).toHaveBeenCalledWith('d1', { is_public: true })
        );
        expect(await screen.findByDisplayValue(/\/v\/d1$/)).toBeTruthy();
        expect(screen.getByDisplayValue(/<iframe/)).toBeTruthy();
        expect(trackEvent).toHaveBeenCalledWith(
            'erd2_share_enable',
            expect.any(String),
            {}
        );
    });

    it('схема не в облаке — сообщение вместо переключателя', async () => {
        vi.mocked(getShareState).mockResolvedValue(null);
        open(1);
        expect(
            await screen.findByText(/ещё не сохранена в облаке/)
        ).toBeTruthy();
        expect(getShareState).toHaveBeenCalledTimes(6);
    });
});
