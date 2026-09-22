import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import { SqllabSyncProvider } from '../sqllab-sync-provider';
import * as auth from '@/lib/sqllab-auth';
import * as wall from '@/lib/upgrade-wall-events';
import { emitSyncNow, onSyncStatus } from '@/lib/sync-status-events';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';

const baseDiagram: Diagram = {
    id: 'diagram-1',
    name: 'Test Diagram',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const fakeTable: DBTable = {
    id: 'table-1',
    name: 'users',
    x: 0,
    y: 0,
    fields: [],
    indexes: [],
    color: '#000000',
    isView: false,
    createdAt: Date.now(),
};

const diagramWithTable: Diagram = {
    ...baseDiagram,
    tables: [fakeTable],
};

describe('SqllabSyncProvider', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    it('pushes the diagram to the backend 2s after it changes', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(2000);

        expect(authFetchSpy).toHaveBeenCalledWith(
            '/api/erd2/diagrams/diagram-1/',
            expect.objectContaining({ method: 'PATCH' })
        );
        const body = JSON.parse(String(authFetchSpy.mock.calls[0][1]?.body));
        expect(body.id).toBe('diagram-1');
        expect(body.title).toBe('Test Diagram');
    });

    it('does not push an empty diagram (zero tables) — free-tier quota guard', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: baseDiagram,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(3000);

        expect(authFetchSpy).not.toHaveBeenCalled();
    });

    it('resumes pushing once the diagram gets its first table', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        const { rerender } = render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: baseDiagram,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(3000);
        expect(authFetchSpy).not.toHaveBeenCalled();

        rerender(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(2000);

        expect(authFetchSpy).toHaveBeenCalledWith(
            '/api/erd2/diagrams/diagram-1/',
            expect.objectContaining({ method: 'PATCH' })
        );
    });

    it('does not push again if the diagram id is empty (no diagram open yet)', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response());

        render(
            <chartDBContext.Provider
                value={{ diagramId: '', currentDiagram: baseDiagram } as never}
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(3000);

        expect(authFetchSpy).not.toHaveBeenCalled();
    });

    it('does not push and makes no network call when the user is not logged in', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue(null);
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: baseDiagram,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(3000);

        expect(authFetchSpy).not.toHaveBeenCalled();
    });

    it('emits the upgrade wall when the backend answers 403 with a limit code', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        vi.spyOn(auth, 'authFetch').mockResolvedValue(
            new Response(
                JSON.stringify({ code: 'table_limit', detail: 'x', limit: 10 }),
                { status: 403 }
            )
        );
        const wallSpy = vi.spyOn(wall, 'emitUpgradeWall');

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(2000);

        expect(wallSpy).toHaveBeenCalledWith({
            reason: 'table_limit',
            limit: 10,
        });
    });

    it('emits the upgrade wall when creating a new diagram (404 then POST 403 diagram_limit)', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        vi.spyOn(auth, 'authFetch')
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ code: 'diagram_limit', limit: 3 }),
                    { status: 403 }
                )
            );
        const wallSpy = vi.spyOn(wall, 'emitUpgradeWall');

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(2000);

        expect(wallSpy).toHaveBeenCalledWith({
            reason: 'diagram_limit',
            limit: 3,
        });
    });

    it('syncs immediately (without waiting 2s) when a sync-now event arrives', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        act(() => emitSyncNow());
        await vi.advanceTimersByTimeAsync(0);

        expect(authFetchSpy).toHaveBeenCalledWith(
            '/api/erd2/diagrams/diagram-1/',
            expect.objectContaining({ method: 'PATCH' })
        );
    });

    it('does not push an empty diagram even when force-syncing with emitSyncNow — canSync guard blocks in triggerSync', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockResolvedValue(new Response(null, { status: 200 }));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: baseDiagram,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        act(() => emitSyncNow());
        await vi.advanceTimersByTimeAsync(0);

        expect(authFetchSpy).not.toHaveBeenCalled();
    });

    it('broadcasts syncing then idle status around a push, including the regular debounced one', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');
        vi.spyOn(auth, 'authFetch').mockResolvedValue(
            new Response(null, { status: 200 })
        );
        const statuses: string[] = [];
        const off = onSyncStatus((status) => statuses.push(status));

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        await vi.advanceTimersByTimeAsync(2000);

        expect(statuses).toEqual(['syncing', 'idle']);
        off();
    });

    it('guards against concurrent force-syncs by queuing a trailing retry instead of dropping the second emit', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');

        // Create a promise we can control the resolution of
        let resolvePush: (() => void) | null = null;
        const pendingPush = new Promise<void>((resolve) => {
            resolvePush = resolve;
        });

        vi.spyOn(auth, 'authFetch').mockImplementation(() => {
            return pendingPush.then(() => new Response(null, { status: 200 }));
        });

        const authFetchSpy = vi.spyOn(auth, 'authFetch');

        render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        // Emit sync-now twice synchronously (before the first promise resolves)
        act(() => {
            emitSyncNow();
            emitSyncNow();
        });

        // Allow microtasks to run (emitSyncNow calls are synchronous but trigger in async context)
        await vi.advanceTimersByTimeAsync(0);

        // authFetch should have been called only once — the second emitSyncNow was
        // blocked by the in-flight guard and queued as a pending retry, not fired
        // concurrently and not silently dropped.
        expect(authFetchSpy).toHaveBeenCalledTimes(1);

        // Now resolve the first push — the queued retry must fire on its own,
        // with no further manual trigger needed.
        act(() => {
            resolvePush?.();
        });
        await vi.advanceTimersByTimeAsync(0);

        // authFetch should now have been called twice: the original sync plus the
        // automatic trailing retry that fired once the first sync finished.
        expect(authFetchSpy).toHaveBeenCalledTimes(2);
    });

    it('retries with the freshest diagram data after a blocking sync finishes (trailing-edge retry)', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('fake-access-token');

        // The first authFetch call hangs until we release it manually, simulating
        // a slow push that outlives the debounce window while the user keeps editing.
        let resolveFirstPush: (() => void) | null = null;
        const firstPushGate = new Promise<void>((resolve) => {
            resolveFirstPush = resolve;
        });

        const authFetchSpy = vi
            .spyOn(auth, 'authFetch')
            .mockImplementationOnce(
                () =>
                    firstPushGate.then(
                        () => new Response(null, { status: 200 })
                    ) as Promise<Response>
            )
            .mockResolvedValue(new Response(null, { status: 200 }));

        const { rerender } = render(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: diagramWithTable,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );

        // Fire the initial debounced sync — it starts and hangs on firstPushGate.
        await vi.advanceTimersByTimeAsync(2000);
        expect(authFetchSpy).toHaveBeenCalledTimes(1);

        // The user keeps editing while the first sync is still in flight: the
        // diagram changes, and a new sync is requested.
        const updatedDiagram: Diagram = {
            ...diagramWithTable,
            name: 'Renamed while syncing',
        };

        rerender(
            <chartDBContext.Provider
                value={
                    {
                        diagramId: 'diagram-1',
                        currentDiagram: updatedDiagram,
                    } as never
                }
            >
                <SqllabSyncProvider />
            </chartDBContext.Provider>
        );
        act(() => emitSyncNow());
        await vi.advanceTimersByTimeAsync(0);

        // The new request was blocked by the in-flight guard (queued, not fired
        // concurrently) — still only one call so far.
        expect(authFetchSpy).toHaveBeenCalledTimes(1);

        // Let the first (now-stale) push complete.
        act(() => {
            resolveFirstPush?.();
        });
        await vi.advanceTimersByTimeAsync(0);

        // The trailing retry must have fired automatically...
        expect(authFetchSpy).toHaveBeenCalledTimes(2);
        // ...and it must have sent the LATEST diagram data, not the stale one
        // captured when the original sync was scheduled.
        const secondCallBody = JSON.parse(
            String(authFetchSpy.mock.calls[1][1]?.body)
        );
        expect(secondCallBody.title).toBe('Renamed while syncing');
    });
});
