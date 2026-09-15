import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import { SqllabSyncProvider } from '../sqllab-sync-provider';
import * as auth from '@/lib/sqllab-auth';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';

const baseDiagram: Diagram = {
    id: 'diagram-1',
    name: 'Test Diagram',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('SqllabSyncProvider', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    it('pushes the diagram to the backend 2s after it changes', async () => {
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

        await vi.advanceTimersByTimeAsync(2000);

        expect(authFetchSpy).toHaveBeenCalledWith(
            '/api/erd2/diagrams/diagram-1/',
            expect.objectContaining({ method: 'PATCH' })
        );
        const body = JSON.parse(String(authFetchSpy.mock.calls[0][1]?.body));
        expect(body.id).toBe('diagram-1');
        expect(body.title).toBe('Test Diagram');
    });

    it('does not push again if the diagram id is empty (no diagram open yet)', async () => {
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
});
