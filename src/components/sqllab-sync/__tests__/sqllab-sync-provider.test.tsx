import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import { SqllabSyncProvider } from '../sqllab-sync-provider';
import * as auth from '@/lib/sqllab-auth';
import * as wall from '@/lib/upgrade-wall-events';
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
});
