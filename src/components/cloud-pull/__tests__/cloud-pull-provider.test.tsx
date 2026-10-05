import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPullPending } from '@/lib/cloud-pull-state';
import { render, waitFor } from '@testing-library/react';
import { storageContext } from '@/context/storage-context/storage-context';
import * as auth from '@/lib/sqllab-auth';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { getLockedCards, setLockedCards } from '@/lib/locked-diagrams';
import { CloudPullProvider } from '../cloud-pull-provider';

const local = (id: string, updatedAt: string, name: string): Diagram => ({
    id,
    name,
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(updatedAt),
});

const cloudRow = (id: string, updated_at: string, title: string) => ({
    id,
    title,
    updated_at,
    content: {
        id,
        name: title,
        databaseType: 'postgresql',
        tables: [],
        relationships: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: updated_at,
    },
});

const setup = (rows: unknown[], existing: Diagram[]) => {
    const storage = {
        listDiagrams: vi.fn().mockResolvedValue(existing),
        addDiagram: vi.fn().mockResolvedValue(undefined),
        deleteDiagram: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(auth, 'getAccessToken').mockReturnValue('token');
    const fetchSpy = vi
        .spyOn(auth, 'authFetch')
        .mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }));
    render(
        <storageContext.Provider value={storage as never}>
            <CloudPullProvider />
        </storageContext.Provider>
    );
    return { storage, fetchSpy };
};

describe('CloudPullProvider', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('adds a cloud diagram that is missing locally', async () => {
        const { storage, fetchSpy } = setup(
            [cloudRow('a1', '2026-09-01T00:00:00Z', 'Магазин')],
            []
        );
        await waitFor(() =>
            expect(storage.addDiagram).toHaveBeenCalledTimes(1)
        );
        expect(fetchSpy).toHaveBeenCalledWith('/api/erd2/diagrams/');
        expect(storage.addDiagram.mock.calls[0][0].diagram.id).toBe('a1');
        expect(storage.deleteDiagram).not.toHaveBeenCalled();
    });

    it('keeps an older local diagram as a copy before replacing it', async () => {
        const { storage } = setup(
            [cloudRow('a1', '2026-09-01T00:00:00Z', 'Облачная')],
            [local('a1', '2026-08-01T00:00:00Z', 'Локальная')]
        );
        await waitFor(() =>
            expect(storage.addDiagram).toHaveBeenCalledTimes(2)
        );
        const first = storage.addDiagram.mock.calls[0][0].diagram;
        const second = storage.addDiagram.mock.calls[1][0].diagram;
        expect(first.id).not.toBe('a1');
        expect(first.name).toBe('Локальная (локальная копия)');
        expect(storage.deleteDiagram).toHaveBeenCalledWith('a1');
        expect(second.id).toBe('a1');
        expect(second.name).toBe('Облачная');
    });

    it('reports pending while pulling and done afterwards', async () => {
        const { storage } = setup(
            [cloudRow('a1', '2026-09-01T00:00:00Z', 'Магазин')],
            []
        );
        expect(isPullPending()).toBe(true);
        await waitFor(() => expect(isPullPending()).toBe(false));
        expect(storage.addDiagram).toHaveBeenCalledTimes(1);
    });

    it('does nothing for anonymous users', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue(null);
        const fetchSpy = vi.spyOn(auth, 'authFetch');
        render(
            <storageContext.Provider value={{} as never}>
                <CloudPullProvider />
            </storageContext.Provider>
        );
        await Promise.resolve();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('survives a failed request', async () => {
        vi.spyOn(auth, 'getAccessToken').mockReturnValue('token');
        vi.spyOn(auth, 'authFetch').mockResolvedValue(
            new Response(null, { status: 500 })
        );
        const storage = {
            listDiagrams: vi.fn(),
            addDiagram: vi.fn(),
            deleteDiagram: vi.fn(),
        };
        render(
            <storageContext.Provider value={storage as never}>
                <CloudPullProvider />
            </storageContext.Provider>
        );
        await Promise.resolve();
        expect(storage.addDiagram).not.toHaveBeenCalled();
    });

    it('does not load locked rows and exposes them as cards', async () => {
        setLockedCards([]);
        const lockedRow = {
            id: 'locked-1',
            title: 'Большая',
            updated_at: '2026-02-01T00:00:00Z',
            locked: true,
            tables: 15,
            db_type: 'postgresql',
        };
        const { storage } = setup(
            [cloudRow('open-1', '2026-02-01T00:00:00Z', 'Открытая'), lockedRow],
            []
        );
        await waitFor(() =>
            expect(storage.addDiagram).toHaveBeenCalledTimes(1)
        );
        expect(storage.addDiagram).toHaveBeenCalledWith({
            diagram: expect.objectContaining({ id: 'open-1' }),
        });
        expect(getLockedCards().map((c) => c.id)).toEqual(['locked-1']);
        expect(getLockedCards()[0].tables).toBe(15);
    });

    it('skips the card when the locked diagram already exists locally', async () => {
        setLockedCards([]);
        const lockedRow = {
            id: 'have-it',
            title: 'Есть локально',
            updated_at: '2026-02-01T00:00:00Z',
            locked: true,
            tables: 15,
        };
        const { storage } = setup(
            [lockedRow],
            [local('have-it', '2026-02-01T00:00:00Z', 'Есть локально')]
        );
        await waitFor(() => expect(storage.listDiagrams).toHaveBeenCalled());
        await Promise.resolve();
        expect(getLockedCards()).toEqual([]);
        expect(storage.addDiagram).not.toHaveBeenCalled();
    });
});
