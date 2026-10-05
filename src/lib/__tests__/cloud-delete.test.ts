import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/sqllab-auth';
import { deleteCloudDiagram } from '../cloud-delete';

describe('deleteCloudDiagram', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('does nothing for anonymous users', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue(null);
        const spy = vi.spyOn(auth, 'authFetch');
        expect(await deleteCloudDiagram('d1')).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });

    it('sends DELETE and treats 204 and 404 as gone', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('t');
        const spy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(new Response(null, { status: 404 }));
        expect(await deleteCloudDiagram('d1')).toBe(true);
        expect(await deleteCloudDiagram('d2')).toBe(true);
        expect(spy).toHaveBeenCalledWith('/api/erd2/diagrams/d1/', {
            method: 'DELETE',
        });
    });

    it('returns false on server error or network failure without throwing', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('t');
        vi.spyOn(auth, 'authFetch')
            .mockResolvedValueOnce(new Response(null, { status: 500 }))
            .mockRejectedValueOnce(new Error('offline'));
        expect(await deleteCloudDiagram('d1')).toBe(false);
        expect(await deleteCloudDiagram('d2')).toBe(false);
    });
});
