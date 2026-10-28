/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downscaleImageIfNeeded } from '../downscale';
import { IMAGE_DOWNSCALE_QUALITY } from '../../limits';

describe('downscaleImageIfNeeded', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  let mockDrawImage: any;
  let mockToBlob: any;
  let mockCanvas: any;

  class MockImage {
    naturalWidth = 0;
    naturalHeight = 0;
    width = 0;
    height = 0;
    private _src = '';
    onload: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    static shouldFail = false;
    static widthToSet = 0;
    static heightToSet = 0;

    get src() {
      return this._src;
    }

    set src(value: string) {
      this._src = value;
      this.naturalWidth = MockImage.widthToSet;
      this.naturalHeight = MockImage.heightToSet;
      this.width = MockImage.widthToSet;
      this.height = MockImage.heightToSet;

      setTimeout(() => {
        if (MockImage.shouldFail) {
          this.onerror?.(new Error('Image decode error'));
        } else {
          this.onload?.();
        }
      }, 0);
    }
  }

  beforeEach(() => {
    MockImage.shouldFail = false;
    MockImage.widthToSet = 0;
    MockImage.heightToSet = 0;

    mockDrawImage = vi.fn();
    mockToBlob = vi.fn((callback: (blob: Blob | null) => void, mime: string) => {
      callback(new Blob(['fake-jpg-content'], { type: mime }));
    });

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn((type: string) => {
        if (type === '2d') {
          return { drawImage: mockDrawImage };
        }
        return null;
      }),
      toBlob: mockToBlob,
    };

    // Setup DOM environment
    (globalThis as any).window = {};
    (globalThis as any).document = {
      createElement: vi.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        if (tagName === 'img') return new MockImage();
        return {};
      }),
    };
    (globalThis as any).Image = MockImage;

    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-blob');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('returns original file and downscaled=false if file is null or undefined', async () => {
    const res = await downscaleImageIfNeeded(null as any);
    expect(res).toEqual({ file: null, downscaled: false });
  });

  it('returns non-image file unchanged without attempting to downscale (e.g. PDF)', async () => {
    const pdfFile = new File(['%PDF-1.4'], 'statement.pdf', {
      type: 'application/pdf',
    });

    const result = await downscaleImageIfNeeded(pdfFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(pdfFile);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('safely handles SSR environment where window or document is undefined', async () => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;

    const imgFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(imgFile);
  });

  it('returns original image unchanged if dimensions are within IMAGE_DOWNSCALE_MAX_EDGE', async () => {
    MockImage.widthToSet = 1600;
    MockImage.heightToSet = 1200;

    const imgFile = new File(['photo-bytes'], 'small.png', {
      type: 'image/png',
    });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(imgFile);
    expect(mockDrawImage).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:http://localhost/test-blob'
    );
  });

  it('downscales wide image when width > IMAGE_DOWNSCALE_MAX_EDGE preserving aspect ratio', async () => {
    // 4000x2000 -> target: 2000 x 1000
    MockImage.widthToSet = 4000;
    MockImage.heightToSet = 2000;

    const imgFile = new File(['photo-bytes'], 'banner.png', {
      type: 'image/png',
    });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(true);
    expect(result.file).not.toBe(imgFile);
    expect(result.file.name).toBe('banner.jpg');
    expect(result.file.type).toBe('image/jpeg');

    expect(mockCanvas.width).toBe(2000);
    expect(mockCanvas.height).toBe(1000);
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      0,
      2000,
      1000
    );
    expect(mockToBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      IMAGE_DOWNSCALE_QUALITY
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:http://localhost/test-blob'
    );
  });

  it('downscales tall image when height > IMAGE_DOWNSCALE_MAX_EDGE preserving aspect ratio', async () => {
    // 1500x3000 -> target: 1000 x 2000
    MockImage.widthToSet = 1500;
    MockImage.heightToSet = 3000;

    const imgFile = new File(['photo-bytes'], 'receipt.webp', {
      type: 'image/webp',
    });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(true);
    expect(result.file.name).toBe('receipt.jpg');
    expect(result.file.type).toBe('image/jpeg');

    expect(mockCanvas.width).toBe(1000);
    expect(mockCanvas.height).toBe(2000);
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      0,
      1000,
      2000
    );
  });

  it('supports custom maxEdge and quality options', async () => {
    // 2000x1000 with maxEdge 1000 -> target: 1000x500
    MockImage.widthToSet = 2000;
    MockImage.heightToSet = 1000;

    const imgFile = new File(['bytes'], 'custom.jpeg', { type: 'image/jpeg' });
    const result = await downscaleImageIfNeeded(imgFile, {
      maxEdge: 1000,
      quality: 0.7,
    });

    expect(result.downscaled).toBe(true);
    expect(mockCanvas.width).toBe(1000);
    expect(mockCanvas.height).toBe(500);
    expect(mockToBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.7
    );
  });

  it('correctly handles filename without extension', async () => {
    MockImage.widthToSet = 3000;
    MockImage.heightToSet = 1500;

    const imgFile = new File(['bytes'], 'captured-bill', {
      type: 'image/jpeg',
    });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(true);
    expect(result.file.name).toBe('captured-bill.jpg');
  });

  it('falls back to original file if image fails to load or decode', async () => {
    MockImage.shouldFail = true;

    const imgFile = new File(['corrupt-data'], 'broken.jpg', {
      type: 'image/jpeg',
    });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(imgFile);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('falls back to original file if canvas context is unavailable', async () => {
    MockImage.widthToSet = 3000;
    MockImage.heightToSet = 2000;
    mockCanvas.getContext = vi.fn(() => null);

    const imgFile = new File(['data'], 'test.png', { type: 'image/png' });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(imgFile);
  });

  it('falls back to original file if toBlob returns null', async () => {
    MockImage.widthToSet = 3000;
    MockImage.heightToSet = 2000;
    mockCanvas.toBlob = vi.fn((cb: (blob: Blob | null) => void) => cb(null));

    const imgFile = new File(['data'], 'test.png', { type: 'image/png' });
    const result = await downscaleImageIfNeeded(imgFile);

    expect(result.downscaled).toBe(false);
    expect(result.file).toBe(imgFile);
  });
});
