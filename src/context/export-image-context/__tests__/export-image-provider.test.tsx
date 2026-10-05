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

let mockDiagramName = 'diagram';

vi.mock('@/hooks/use-chartdb', () => ({
    useChartDB: () => ({ diagramName: mockDiagramName }),
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

// Minimal stand-in for the browser `Image` constructor, used only by the
// PNG/JPEG watermark-branch tests below. The provider creates one `Image`
// per `new Image()` call (first the rendered diagram, then the logo) and
// waits on that instance's `onload`/`onerror`. Capturing every instance in
// creation order lets a test grab exactly the instance it wants to drive,
// without needing real image decoding (which happy-dom doesn't perform).
type MockImageInstance = {
    src: string;
    width: number;
    height: number;
    onload: (() => void) | null;
    onerror: (() => void) | null;
};

let createdImages: MockImageInstance[] = [];

class MockImage implements MockImageInstance {
    src = '';
    width = 100;
    height = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
        createdImages.push(this);
    }
}

describe('ExportImageProvider exportImage', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockShowLoader.mockClear();
        mockHideLoader.mockClear();
        mockSetNodes.mockClear();
        mockToPng.mockReset();
        mockToJpeg.mockReset();
        mockToSvg.mockReset();
        createdImages = [];
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        mockDiagramName = 'diagram';
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

    // The two tests below cover the PNG/JPEG watermark-compositing branch,
    // which loads the freshly-rendered diagram into an `Image`, draws it to
    // a canvas, then loads the logo into a second `Image` and draws that on
    // top. Both loads are wired through `Image.onerror` so a failed load
    // rejects the export instead of hanging forever. `happy-dom` doesn't
    // perform real image decoding, so these tests stub the global `Image`
    // constructor (capturing every instance in creation order) and stub
    // `HTMLCanvasElement.prototype.getContext` (happy-dom's real
    // implementation returns `null`, which would otherwise make the
    // provider skip the whole watermark path via its `if (!ctx)`
    // short-circuit). Against the pre-fix code - where the diagram/logo
    // `Image` objects had no `onerror` handler at all - both tests below
    // would time out waiting for `promise` to settle, since nothing would
    // ever reject (or resolve) it.
    it('rejects rather than hanging when the rendered diagram image fails to load (PNG watermark branch)', async () => {
        addReactFlowContainer();
        mockToPng.mockResolvedValue('data:image/png;base64,INITIAL');

        const fakeCtx = {
            drawImage: vi.fn(),
            globalAlpha: 1,
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            fakeCtx
        );
        vi.stubGlobal('Image', MockImage);

        const result = renderExportImage();
        const priorImageCount = createdImages.length;

        const promise = result.current.exportImage('png', exportOptions);
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(0);

        const diagramImage = createdImages[priorImageCount];
        expect(diagramImage).toBeDefined();

        diagramImage.onerror?.();

        await expect(promise).rejects.toThrow(
            'Failed to load the rendered diagram image'
        );
    });

    it('rejects rather than hanging when the logo image fails to load after the diagram loads successfully (PNG watermark branch)', async () => {
        addReactFlowContainer();
        mockToPng.mockResolvedValue('data:image/png;base64,INITIAL');

        const fakeCtx = {
            drawImage: vi.fn(),
            globalAlpha: 1,
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            fakeCtx
        );
        vi.stubGlobal('Image', MockImage);

        const result = renderExportImage();
        const priorImageCount = createdImages.length;

        const promise = result.current.exportImage('png', exportOptions);
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(0);

        const diagramImage = createdImages[priorImageCount];
        expect(diagramImage).toBeDefined();

        // Diagram loads fine. The provider's onload handler runs
        // synchronously up to the point where it constructs the logo
        // `Image` and assigns its handlers (it only suspends once it
        // `await`s that image's own load/error promise), so the logo
        // instance is available immediately after this call returns.
        diagramImage.onload?.();

        const logoImage = createdImages[priorImageCount + 1];
        expect(logoImage).toBeDefined();

        logoImage.onerror?.();

        await expect(promise).rejects.toThrow(
            'Failed to load logo image for watermark'
        );
    });

    // Guards a fix for a real bug: downloadImage() used to build the
    // download filename from the raw diagramName (which can contain
    // Cyrillic, spaces, or other filename-unsafe characters) concatenated
    // directly with the image `type`, so a JPEG export downloaded as
    // `<name>.jpeg` (not the canonical `.jpg`) with no sanitization at all -
    // unlike every text-based export, which already goes through
    // exportFileName(). Against the pre-fix code, this test would see a
    // `download` attribute like `Мой Магазин.jpeg`: wrong extension, raw
    // Cyrillic intact.
    it('uses an exportFileName-sanitized diagramName with a canonical .jpg extension for the download filename (Cyrillic name, jpeg type)', async () => {
        mockDiagramName = 'Мой Магазин';
        addReactFlowContainer();

        const click = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => undefined);
        const setAttributeSpy = vi.spyOn(
            HTMLAnchorElement.prototype,
            'setAttribute'
        );

        mockToJpeg.mockResolvedValue('data:image/jpeg;base64,INITIAL');

        const fakeCtx = {
            drawImage: vi.fn(),
            globalAlpha: 1,
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            fakeCtx
        );
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
            'data:image/jpeg;base64,FINAL'
        );
        vi.stubGlobal('Image', MockImage);

        const result = renderExportImage();
        const priorImageCount = createdImages.length;

        const promise = result.current.exportImage('jpeg', exportOptions);
        promise.catch(() => undefined);

        await vi.advanceTimersByTimeAsync(0);

        const diagramImage = createdImages[priorImageCount];
        expect(diagramImage).toBeDefined();
        diagramImage.onload?.();

        const logoImage = createdImages[priorImageCount + 1];
        expect(logoImage).toBeDefined();
        logoImage.onload?.();

        await promise;

        expect(click).toHaveBeenCalledTimes(1);
        const downloadCall = setAttributeSpy.mock.calls.find(
            ([attr]) => attr === 'download'
        );
        expect(downloadCall).toBeDefined();
        const filename = downloadCall?.[1] as string;
        expect(filename.endsWith('.jpg')).toBe(true);
        expect(filename).not.toMatch(/[а-яё]/i);
    });
});

// Превью строится по тому же DOM, что и экспорт, и без вписанных стилей связей
// на картинке пропадают линии и стрелки (skipFonts отключает обработку CSS).
describe('ExportImageProvider previewImage', () => {
    beforeEach(() => {
        mockToPng.mockReset();
        document.body.innerHTML = '';
    });

    const addRelationDom = () => {
        const container = addReactFlowContainer();
        const viewport = container.querySelector(
            '.react-flow__viewport'
        ) as HTMLElement;
        const path = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );
        path.setAttribute('class', 'react-flow__edge-path');
        viewport.appendChild(path);

        const markers = document.createElement('div');
        markers.className = 'marker-definitions';
        markers.innerHTML =
            '<svg><defs><marker id="m1"><circle r="3"></circle></marker></defs></svg>';
        document.body.appendChild(markers);
        return { viewport, path };
    };

    it('puts a copy of the relation markers into the snapshot and cleans up afterwards', async () => {
        const { viewport } = addRelationDom();
        let markersDuringSnapshot = false;
        mockToPng.mockImplementation(() => {
            markersDuringSnapshot =
                viewport.querySelector('marker#m1') !== null;
            return Promise.resolve('data:image/png;base64,P');
        });

        const result = renderExportImage();
        const url = await result.current.previewImage('png', {
            transparent: true,
            includePatternBG: false,
        });

        expect(url).toBe('data:image/png;base64,P');
        expect(markersDuringSnapshot).toBe(true);
        // после снимка во viewport не остаётся служебных узлов
        expect(viewport.querySelector('marker#m1')).toBeNull();
        expect(viewport.querySelectorAll('svg').length).toBe(0);
    });

    it('restores the edge styles even when the snapshot fails', async () => {
        const { path } = addRelationDom();
        mockToPng.mockRejectedValue(new Error('boom'));

        const result = renderExportImage();
        await expect(
            result.current.previewImage('png', {
                transparent: true,
                includePatternBG: false,
            })
        ).rejects.toThrow('boom');

        expect(path.style.stroke).toBe('');
        expect(path.style.strokeWidth).toBe('');
    });
});
