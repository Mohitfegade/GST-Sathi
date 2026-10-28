/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UploadQueue, defaultUploadFn } from '../queue';
import type { PrepareUploadsResult } from '../../types';

describe('UploadQueue', () => {
  let mockPrepareUploads: any;
  let mockConfirmUpload: any;
  let mockUploadFn: any;
  let eventListeners: Record<string, EventListenerOrEventListenerObject[]> = {};

  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  );

  beforeEach(() => {
    eventListeners = {};

    // Mock window event listeners for online/offline events
    (globalThis as any).window = {
      addEventListener: vi.fn((event: string, handler: any) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: any) => {
        if (!eventListeners[event]) return;
        eventListeners[event] = eventListeners[event].filter(
          (h) => h !== handler
        );
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        const handlers = eventListeners[event.type] || [];
        for (const handler of handlers) {
          if (typeof handler === 'function') {
            handler(event as any);
          } else if (handler && typeof handler.handleEvent === 'function') {
            handler.handleEvent(event as any);
          }
        }
        return true;
      }),
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    mockPrepareUploads = vi.fn(
      async (clientId: string, files: any[]): Promise<PrepareUploadsResult> => {
        return {
          prepared: files.map((f, i) => ({
            documentId: `doc-${f.originalName}-${i}`,
            originalName: f.originalName,
            storagePath: `firm-1/${clientId}/doc-${f.originalName}`,
            signedUploadUrl: `https://storage.example.com/upload/${f.originalName}`,
          })),
          duplicates: [],
          rejected: [],
        };
      }
    );

    mockConfirmUpload = vi.fn(async (_docId: string) => ({
      success: true,
    }));

    mockUploadFn = vi.fn(
      async (_url: string, _file: File, onProgress: (pct: number) => void) => {
        onProgress(50);
        onProgress(100);
      }
    );
  });

  afterEach(() => {
    delete (globalThis as any).window;
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    }
    vi.restoreAllMocks();
  });

  it('processes a single file through the full status lifecycle', async () => {
    const statuses: string[] = [];
    const progresses: number[] = [];

    const queue = new UploadQueue({
      clientId: 'client-123',
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
      onItemStatusChange: (_item, status) => {
        statuses.push(status);
      },
      onItemProgress: (_item, progress) => {
        progresses.push(progress);
      },
    });

    const file = new File(['bill content'], 'bill.pdf', {
      type: 'application/pdf',
    });

    const id = queue.add(file);
    expect(id).toBeDefined();

    // Wait for queue processing to complete
    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('done');
    });

    const item = queue.getItem(id)!;
    expect(item.status).toBe('done');
    expect(item.progress).toBe(100);
    expect(item.documentId).toBe('doc-bill.pdf-0');

    // Expected transition sequence: idle -> downscaling -> hashing -> preparing -> uploading -> confirming -> done
    expect(statuses).toEqual([
      'idle',
      'downscaling',
      'hashing',
      'preparing',
      'uploading',
      'confirming',
      'done',
    ]);

    expect(progresses).toContain(50);
    expect(progresses).toContain(100);

    expect(mockPrepareUploads).toHaveBeenCalledWith(
      'client-123',
      expect.arrayContaining([
        expect.objectContaining({
          originalName: 'bill.pdf',
          mimeType: 'application/pdf',
        }),
      ])
    );
    expect(mockUploadFn).toHaveBeenCalled();
    expect(mockConfirmUpload).toHaveBeenCalledWith('doc-bill.pdf-0');
  });

  it('respects concurrency limit of 3 parallel uploads', async () => {
    const activeUploads: string[] = [];
    let maxSimultaneous = 0;
    const resolvers: Record<string, () => void> = {};

    mockUploadFn = vi.fn(
      (_url: string, file: File, _onProgress: (p: number) => void) => {
        return new Promise<void>((resolve) => {
          activeUploads.push(file.name);
          maxSimultaneous = Math.max(maxSimultaneous, activeUploads.length);
          resolvers[file.name] = () => {
            const index = activeUploads.indexOf(file.name);
            if (index !== -1) activeUploads.splice(index, 1);
            resolve();
          };
        });
      }
    );

    const queue = new UploadQueue({
      clientId: 'client-concurrency',
      concurrency: 3,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const files = [
      new File(['1'], 'f1.pdf', { type: 'application/pdf' }),
      new File(['2'], 'f2.pdf', { type: 'application/pdf' }),
      new File(['3'], 'f3.pdf', { type: 'application/pdf' }),
      new File(['4'], 'f4.pdf', { type: 'application/pdf' }),
      new File(['5'], 'f5.pdf', { type: 'application/pdf' }),
    ];

    queue.addFiles(files);

    // Wait until 3 uploads are in flight
    await vi.waitFor(() => {
      expect(activeUploads.length).toBe(3);
    });

    expect(maxSimultaneous).toBe(3);

    // Resolve first upload; fourth should start
    resolvers['f1.pdf']();
    await vi.waitFor(() => {
      expect(activeUploads).toContain('f4.pdf');
    });
    expect(maxSimultaneous).toBe(3);

    // Resolve remaining uploads
    resolvers['f2.pdf']();
    resolvers['f3.pdf']();
    await vi.waitFor(() => {
      expect(activeUploads).toContain('f5.pdf');
    });

    resolvers['f4.pdf']();
    resolvers['f5.pdf']();

    await vi.waitFor(() => {
      const items = queue.getItems();
      expect(items.every((i) => i.status === 'done')).toBe(true);
    });

    expect(maxSimultaneous).toBe(3);
  });

  it('handles duplicate detection from prepareUploads', async () => {
    mockPrepareUploads = vi.fn(async () => ({
      prepared: [],
      duplicates: [
        {
          originalName: 'dup.pdf',
          sha256: 'abc123sha',
          existingDocumentId: 'existing-doc-999',
          message: 'Already uploaded',
        },
      ],
      rejected: [],
    }));

    const queue = new UploadQueue({
      clientId: 'client-dup',
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['dup'], 'dup.pdf', { type: 'application/pdf' });
    const id = queue.add(file);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('duplicate');
    });

    const item = queue.getItem(id)!;
    expect(item.status).toBe('duplicate');
    expect(item.documentId).toBe('existing-doc-999');
    expect(item.progress).toBe(100);
    expect(mockUploadFn).not.toHaveBeenCalled();
    expect(mockConfirmUpload).not.toHaveBeenCalled();
  });

  it('handles rejected files from prepareUploads', async () => {
    mockPrepareUploads = vi.fn(async () => ({
      prepared: [],
      duplicates: [],
      rejected: [
        {
          originalName: 'bad.pdf',
          reason: 'File size exceeds firm limit',
        },
      ],
    }));

    const queue = new UploadQueue({
      clientId: 'client-reject',
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['bad'], 'bad.pdf', { type: 'application/pdf' });
    const id = queue.add(file);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('error');
    });

    const item = queue.getItem(id)!;
    expect(item.status).toBe('error');
    expect(item.error).toBe('File size exceeds firm limit');
  });

  it('retries on network error with exponential backoff up to maxRetries', async () => {
    let callCount = 0;
    mockUploadFn = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        throw new TypeError('Failed to fetch');
      }
      // Succeed on 3rd attempt
    });

    const queue = new UploadQueue({
      clientId: 'client-retry',
      maxRetries: 3,
      initialBackoffMs: 5,
      backoffMultiplier: 2,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['data'], 'retry.pdf', { type: 'application/pdf' });
    const id = queue.add(file);

    await vi.waitFor(
      () => {
        const item = queue.getItem(id);
        expect(item?.status).toBe('done');
      },
      { timeout: 3000 }
    );

    expect(callCount).toBe(3);
    const item = queue.getItem(id)!;
    expect(item.status).toBe('done');
  });

  it('transitions to error status when retries are exhausted', async () => {
    mockUploadFn = vi.fn(async () => {
      throw new TypeError('Network error');
    });

    const queue = new UploadQueue({
      clientId: 'client-exhaust',
      maxRetries: 2,
      initialBackoffMs: 5,
      backoffMultiplier: 1.5,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['data'], 'fail.pdf', { type: 'application/pdf' });
    const id = queue.add(file);

    await vi.waitFor(
      () => {
        const item = queue.getItem(id);
        expect(item?.status).toBe('error');
      },
      { timeout: 3000 }
    );

    const item = queue.getItem(id)!;
    expect(item.status).toBe('error');
    expect(item.error).toBe('Network error');
    // Initial attempt + 2 retries = 3 calls
    expect(mockUploadFn).toHaveBeenCalledTimes(3);
  });

  it('pauses on offline event and resumes on online event', async () => {
    let uploadStarted = false;
    let resolveUpload: () => void = () => {};

    mockUploadFn = vi.fn(
      () =>
        new Promise<void>((res) => {
          uploadStarted = true;
          resolveUpload = res;
        })
    );

    const queue = new UploadQueue({
      clientId: 'client-offline',
      concurrency: 1,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file1 = new File(['1'], 'f1.pdf', { type: 'application/pdf' });
    const file2 = new File(['2'], 'f2.pdf', { type: 'application/pdf' });

    queue.add(file1);
    queue.add(file2);

    await vi.waitFor(() => {
      expect(uploadStarted).toBe(true);
    });

    // Simulate going offline
    (globalThis as any).window.dispatchEvent({ type: 'offline' });
    expect(queue.isPaused()).toBe(true);

    // Complete file1
    resolveUpload();

    // Wait a brief moment; file2 should remain idle while offline
    await new Promise((r) => setTimeout(r, 50));
    const item2 = queue.getItems().find((i) => i.originalName === 'f2.pdf')!;
    expect(item2.status).toBe('idle');

    // Simulate coming back online
    (globalThis as any).window.dispatchEvent({ type: 'online' });
    expect(queue.isPaused()).toBe(false);

    // file2 should now start and complete
    await vi.waitFor(() => {
      const items = queue.getItems();
      const i2 = items.find((i) => i.originalName === 'f2.pdf')!;
      expect(i2.status).toBe('uploading');
    });

    resolveUpload();

    await vi.waitFor(() => {
      const items = queue.getItems();
      expect(items.every((i) => i.status === 'done')).toBe(true);
    });
  });

  it('supports aborting an in-flight upload', async () => {
    let uploadAborted = false;

    mockUploadFn = vi.fn(
      (_url: string, _file: File, _onProgress: any, signal?: AbortSignal) => {
        return new Promise<void>((_res, rej) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              uploadAborted = true;
              rej(new DOMException('Upload aborted', 'AbortError'));
            });
          }
        });
      }
    );

    const queue = new UploadQueue({
      clientId: 'client-abort',
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['data'], 'abort-me.pdf', {
      type: 'application/pdf',
    });
    const id = queue.add(file);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('uploading');
    });

    queue.abort(id);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('error');
      expect(item?.error).toBe('Upload aborted');
    });

    expect(uploadAborted).toBe(true);
  });

  it('supports abortAll to cancel all in-flight and queued uploads', async () => {
    mockUploadFn = vi.fn(
      (_url: string, _file: File, _onProgress: any, signal?: AbortSignal) => {
        return new Promise<void>((_res, rej) => {
          signal?.addEventListener('abort', () => {
            rej(new DOMException('Upload aborted', 'AbortError'));
          });
        });
      }
    );

    const queue = new UploadQueue({
      clientId: 'client-abort-all',
      concurrency: 1,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const f1 = new File(['1'], 'f1.pdf', { type: 'application/pdf' });
    const f2 = new File(['2'], 'f2.pdf', { type: 'application/pdf' });

    queue.addFiles([f1, f2]);

    await vi.waitFor(() => {
      const items = queue.getItems();
      expect(items[0]?.status).toBe('uploading');
      expect(items[1]?.status).toBe('idle');
    });

    queue.abortAll();

    await vi.waitFor(() => {
      const items = queue.getItems();
      expect(items.every((i) => i.status === 'error')).toBe(true);
      expect(items.every((i) => i.error === 'Upload aborted')).toBe(true);
    });
  });

  it('supports manual retry for errored items', async () => {
    let failFirstTime = true;
    mockUploadFn = vi.fn(async () => {
      if (failFirstTime) {
        throw new Error('Immediate failure');
      }
    });

    const queue = new UploadQueue({
      clientId: 'client-manual-retry',
      maxRetries: 0,
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
    });

    const file = new File(['data'], 'retry-me.pdf', {
      type: 'application/pdf',
    });
    const id = queue.add(file);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('error');
    });

    failFirstTime = false;
    queue.retry(id);

    await vi.waitFor(() => {
      const item = queue.getItem(id);
      expect(item?.status).toBe('done');
    });

    expect(queue.getItem(id)!.status).toBe('done');
  });

  it('triggers onQueueComplete callback when all items finish', async () => {
    const onQueueComplete = vi.fn();

    const queue = new UploadQueue({
      clientId: 'client-complete',
      prepareUploads: mockPrepareUploads,
      confirmUpload: mockConfirmUpload,
      uploadFn: mockUploadFn,
      onQueueComplete,
    });

    const f1 = new File(['1'], 'f1.pdf', { type: 'application/pdf' });
    const f2 = new File(['2'], 'f2.pdf', { type: 'application/pdf' });

    queue.addFiles([f1, f2]);

    await vi.waitFor(() => {
      expect(onQueueComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('cleans up event listeners and cancels timers on destroy', () => {
    const queue = new UploadQueue({
      clientId: 'client-destroy',
    });

    expect(eventListeners['online']?.length).toBe(1);
    expect(eventListeners['offline']?.length).toBe(1);

    queue.destroy();

    expect(eventListeners['online']?.length).toBe(0);
    expect(eventListeners['offline']?.length).toBe(0);
  });

  it('integrates downscaling for high-resolution images in queue', async () => {
    // Mock canvas environment for downscaling inside queue
    class MockImg {
      naturalWidth = 3000;
      naturalHeight = 1500;
      width = 3000;
      height = 1500;
      private _src = '';
      onload: (() => void) | null = null;
      get src() {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        setTimeout(() => this.onload?.(), 0);
      }
    }

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((cb: any) =>
        cb(new Blob(['downscaled-bytes'], { type: 'image/jpeg' }))
      ),
    };

    (globalThis as any).document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas;
        if (tag === 'img') return new MockImg();
        return {};
      }),
    };
    (globalThis as any).Image = MockImg;
    (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock-image');
    (globalThis as any).URL.revokeObjectURL = vi.fn();

    try {
      const queue = new UploadQueue({
        clientId: 'client-downscale-integration',
        prepareUploads: mockPrepareUploads,
        confirmUpload: mockConfirmUpload,
        uploadFn: mockUploadFn,
      });

      const highResImage = new File(['raw-image-bytes'], 'large-photo.png', {
        type: 'image/png',
      });

      const id = queue.add(highResImage);

      await vi.waitFor(() => {
        const item = queue.getItem(id);
        expect(item?.status).toBe('done');
      });

      const item = queue.getItem(id)!;
      // Item name should be updated to .jpg
      expect(item.originalName).toBe('large-photo.jpg');

      // prepareUploads should have received the downscaled file's metadata
      expect(mockPrepareUploads).toHaveBeenCalledWith(
        'client-downscale-integration',
        expect.arrayContaining([
          expect.objectContaining({
            originalName: 'large-photo.jpg',
            mimeType: 'image/jpeg',
          }),
        ])
      );
    } finally {
      delete (globalThis as any).document;
      delete (globalThis as any).Image;
    }
  });

  it('defaultUploadFn uses fetch when XMLHttpRequest is undefined and reports 100% on success', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
    }));
    globalThis.fetch = mockFetch as any;

    try {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const progressCb = vi.fn();

      await defaultUploadFn('https://storage.test/put', file, progressCb);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://storage.test/put',
        expect.objectContaining({
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
      expect(progressCb).toHaveBeenCalledWith(100);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('defaultUploadFn throws error if fetch fails with non-ok status', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));
    globalThis.fetch = mockFetch as any;

    try {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const progressCb = vi.fn();

      await expect(
        defaultUploadFn('https://storage.test/put', file, progressCb)
      ).rejects.toThrow('Upload failed with status 403');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
