import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ExportImageProvider } from '../export-image-provider';
import { useExportImage } from '@/hooks/use-export-image';

// This suite guards a fix for a real bug: exportImage() used to schedule
// its real work (DOM snapshot, watermark compositing, download) inside a
// bare `setTimeout(async () => {...}, 0)` while the outer function itself
// stayed `async` and returned before that timeout fired. That made the
// returned promise resolve immediately - before the image was actually
// produced - and resolve the same way even when the export failed. Callers
// (see image-tab.tsx) `await exportImage(...)` and then fire the
// `erd2_export` analytics event / review nudge and clear the "busy" spinner,
// so all three used to fire too early and identically on success or failure.
//
// Against the pre-fix code, cases (a) and (c) below would fail: (a) would
// see the promise resolve on the very first microtask flush, before the
// mocked toSvg()/downloadImage() call ever happened; (c) would see the
// promise resolve instead of reject when image creation throws. Case (b)
// would fail too, since the pre-fix early-return path resolved (via an
// implicit `return;` inside an async function) instead of rejecting.

const mockShowLoader = vi.fn();
const mockHideLoader = vi.fn();
const mockSetNodes = vi.fn();
const mockToPng = vi.fn();
const mockToJpeg = vi.fn();
const mockToSvg = vi.fn();

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ diagramName: 'diagram' }),
}));

vi.mock('@/hooks/use-full-screen-spinner', () => ({
    useFullScreenLoader: () => ({
        showLoader: mockShowLoader,
        hideLoader: mockHideLoader,
    }),
}));

vi.mock('@/hooks/use-theme', () => ({
    useTheme: () => ({ effectiveTheme: 'light' }),
}));

vi.mock('@xyflow/react', () => ({
    useReactFlow: () => ({
        setNodes: mockSetNodes,
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
}));

vi.mock('html-to-image', () => ({
    toPng: (...args: unknown[]) => mockToPng(...args),
    toJpeg: (...args: unknown[]) => mockToJpeg(...args),
    toSvg: (...args: unknown[]) => mockToSvg(...args),
}));

const renderExportImage = () => {
    const { result } = renderHook(() => useExportImage(), {
        wrapper: ({ children }) => (
            <ExportImageProvider>{children}</ExportImageProvider>
        ),
    });
    return result;
};

// Builds the minimal DOM the provider walks: a `.react-flow` element (used
// for the container-bounds check) containing a `.react-flow__viewport`
// element (used as the node the export snapshot/watermark work operates on).
const addReactFlowContainer = () => {
    const container = document.createElement('div');
    container.className = 'react-flow';
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    container.appendChild(viewport);
    document.body.appendChild(container);
    return container;
};

const exportOptions = {
    includePatternBG: false,
    transparent: false,
    scale: 1,
};

describe('ExportImageProvider exportImage', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockShowLoader.mockClear();
        mockHideLoader.mockClear();
        mockSetNodes.mockClear();
        mockToPng.mockReset();
        mockToJpeg.mockReset();
        mockToSvg.mockReset();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not resolve until the setTimeout macrotask has run and the image work inside it has completed', async () => {
        addReactFlowContainer();
        const click = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => undefined);

        let resolveToSvg!: (value: string) => void;
        const deferredImage = new Promise<string>((resolve) => {
            resolveToSvg = resolve;
        });
        mockToSvg.mockReturnValue(deferredImage);

        const result = renderExportImage();
        const promise = result.current.exportImage('svg', exportOptions);

        let settled = false;
        promise.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            }
        );

        // Flush the setTimeout(..., 0) macrotask. The async work inside it
        // has started (toSvg was called) but is still suspended awaiting
        // the (still-pending) image-creation promise.
        await vi.advanceTimersByTimeAsync(0);
        expect(mockToSvg).toHaveBeenCalledTimes(1);
        expect(settled).toBe(false);
        expect(click).not.toHaveBeenCalled();

        // Only once the mocked image-creation call resolves does the real
        // download happen, and only then should exportImage's own promise
        // resolve.
        resolveToSvg('data:image/svg+xml;base64,AAAA');
        await promise;

        expect(settled).toBe(true);
        expect(click).toHaveBeenCalledTimes(1);
    });

    it('rejects, without throwing synchronously or resolving silently, when the .react-flow container is missing', async () => {
        // Deliberately not calling addReactFlowContainer() here: no
        // `.react-flow` element exists in the document.
        const result = renderExportImage();

        let promise: Promise<void> | undefined;
        expect(() => {
            promise = result.current.exportImage('png', exportOptions);
            promise.catch(() => undefined);
        }).not.toThrow();

        await expect(promise).rejects.toThrow(
            'Could not find React Flow container'
        );
        expect(mockHideLoader).toHaveBeenCalledTimes(1);
        expect(mockToPng).not.toHaveBeenCalled();
    });

    it('rejects rather than hanging or resolving when image creation fails', async () => {
        addReactFlowContainer();
        mockToSvg.mockRejectedValue(new Error('encode failed'));

        const result = renderExportImage();
        const promise = result.current.exportImage('svg', exportOptions);
        // Attach a rejection listener synchronously, before advancing the
        // fake timer, so the promise is never briefly "unhandled" once the
        // setTimeout callback rejects it.
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(0);

        await expect(promise).rejects.toThrow('encode failed');
    });
});
