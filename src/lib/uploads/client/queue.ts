import { CONCURRENT_UPLOADS_LIMIT } from '../limits';
import type {
  PrepareUploadFile,
  PrepareUploadsResult,
  PreparedUpload,
  UploadQueueItem,
} from '../types';
import { downscaleImageIfNeeded } from './downscale';
import { computeSha256 } from '../hash';

export type UploadStatus = UploadQueueItem['status'];

export type UploadProgressCallback = (
  item: UploadQueueItem,
  progress: number
) => void;
export type ItemStatusCallback = (
  item: UploadQueueItem,
  status: UploadStatus
) => void;
export type ItemUpdateCallback = (item: UploadQueueItem) => void;
export type QueueCompleteCallback = () => void;

export type UploadFn = (
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
) => Promise<void>;

export interface UploadQueueOptions {
  clientId?: string;
  periodFp?: string | null;
  concurrency?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;

  prepareUploads?: (
    clientId: string,
    files: PrepareUploadFile[]
  ) => Promise<PrepareUploadsResult>;
  confirmUpload?: (
    documentId: string
  ) => Promise<{ success: boolean; error?: string }>;
  uploadFn?: UploadFn;

  onItemProgress?: UploadProgressCallback;
  onItemStatusChange?: ItemStatusCallback;
  onItemUpdate?: ItemUpdateCallback;
  onQueueComplete?: QueueCompleteCallback;
}

export interface QueueItemInternal extends UploadQueueItem {
  retryCount: number;
  abortController?: AbortController;
  periodFp?: string | null;
  prepared?: PreparedUpload;
}

/**
 * Default upload function using XMLHttpRequest for upload progress in browsers,
 * or fetch in Node/testing environments.
 */
export async function defaultUploadFn(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      }

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Upload aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new DOMException('Upload aborted', 'AbortError'));
        });
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          );
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(
            new Error(
              `Upload failed with status ${xhr.status}: ${xhr.statusText || 'Error'}`
            )
          );
        }
      };

      xhr.onerror = () => {
        reject(new TypeError('Network error during upload'));
      };

      xhr.onabort = () => {
        reject(new DOMException('Upload aborted', 'AbortError'));
      };

      xhr.send(file);
    });
  }

  // Fallback to fetch for Node.js / test environments
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: file.type ? { 'Content-Type': file.type } : undefined,
    signal,
  });

  if (!res.ok) {
    throw new Error(
      `Upload failed with status ${res.status}: ${res.statusText || 'Error'}`
    );
  }
  onProgress(100);
}

/**
 * Client Upload Manager & Queue.
 *
 * Coordinates downscaling, hashing, preparing, uploading to signed URLs, and confirming.
 * Concurrency: bounded by options.concurrency (default 3).
 * Retries: per-file exponential backoff on network errors (default 3 retries).
 * Offline listener: pauses on 'offline' event, resumes on 'online' event.
 * Abort: supports per-item and full queue aborts.
 */
export class UploadQueue {
  private items: QueueItemInternal[] = [];
  private concurrency: number;
  private maxRetries: number;
  private initialBackoffMs: number;
  private backoffMultiplier: number;
  private maxBackoffMs: number;
  private clientId: string;

  private runningCount: number = 0;
  private isManuallyPaused: boolean = false;
  private isOffline: boolean = false;
  private waitingRetries: Set<string> = new Set();
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private abortedItems: Set<string> = new Set();
  private hasCompletedBatch: boolean = false;

  private onlineHandler?: () => void;
  private offlineHandler?: () => void;

  constructor(private options: UploadQueueOptions = {}) {
    this.concurrency = options.concurrency ?? CONCURRENT_UPLOADS_LIMIT;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.maxBackoffMs = options.maxBackoffMs ?? 10000;
    this.clientId = options.clientId ?? '';

    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      this.isOffline =
        typeof navigator !== 'undefined' && navigator.onLine === false;

      this.onlineHandler = () => {
        this.isOffline = false;
        this.processQueue();
      };

      this.offlineHandler = () => {
        this.isOffline = true;
      };

      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  public setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  public add(
    file: File,
    options?: { id?: string; periodFp?: string | null }
  ): string {
    const id =
      options?.id ??
      `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const item: QueueItemInternal = {
      id,
      file,
      originalName: file.name,
      sizeBytes: file.size,
      progress: 0,
      status: 'idle',
      retryCount: 0,
      periodFp: options?.periodFp ?? this.options.periodFp,
    };

    this.items.push(item);
    this.hasCompletedBatch = false;
    this.options.onItemUpdate?.(item);
    this.options.onItemStatusChange?.(item, 'idle');

    this.processQueue();
    return id;
  }

  public addFiles(
    files: File[],
    options?: { periodFp?: string | null }
  ): string[] {
    return files.map((file) => this.add(file, options));
  }

  public getItems(): UploadQueueItem[] {
    return this.items.map((i) => ({ ...i }));
  }

  public getItem(id: string): UploadQueueItem | undefined {
    const item = this.items.find((i) => i.id === id);
    return item ? { ...item } : undefined;
  }

  public pause(): void {
    this.isManuallyPaused = true;
  }

  public resume(): void {
    this.isManuallyPaused = false;
    this.processQueue();
  }

  public isPaused(): boolean {
    return this.isManuallyPaused || this.isOffline;
  }

  public isNetworkOnline(): boolean {
    return !this.isOffline;
  }

  public abort(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    this.abortedItems.add(id);

    const timer = this.retryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(id);
    }
    this.waitingRetries.delete(id);

    if (item.abortController) {
      item.abortController.abort();
    }

    this.setItemStatus(item, 'error', { error: 'Upload aborted' });
    this.processQueue();
  }

  public abortAll(): void {
    for (const item of this.items) {
      if (
        item.status !== 'done' &&
        item.status !== 'duplicate' &&
        item.status !== 'error'
      ) {
        this.abort(item.id);
      }
    }
  }

  public retry(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.status !== 'error') return;

    this.abortedItems.delete(id);
    this.waitingRetries.delete(id);
    item.retryCount = 0;
    item.error = undefined;
    item.progress = 0;
    this.hasCompletedBatch = false;
    this.setItemStatus(item, 'idle');
    this.processQueue();
  }

  public clearCompleted(): void {
    this.items = this.items.filter(
      (i) => i.status !== 'done' && i.status !== 'duplicate' && i.status !== 'error'
    );
  }

  public destroy(): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler);
      }
    }

    this.retryTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.retryTimers.clear();
    this.waitingRetries.clear();

    this.abortAll();
  }

  private setItemProgress(item: QueueItemInternal, progress: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    item.progress = clamped;
    this.options.onItemProgress?.(item, clamped);
    this.options.onItemUpdate?.(item);
  }

  private setItemStatus(
    item: QueueItemInternal,
    status: UploadStatus,
    extra?: { error?: string; documentId?: string }
  ): void {
    item.status = status;
    if (extra?.error !== undefined) item.error = extra.error;
    if (extra?.documentId !== undefined) item.documentId = extra.documentId;
    this.options.onItemStatusChange?.(item, status);
    this.options.onItemUpdate?.(item);
  }

  private processQueue(): void {
    if (this.isPaused()) {
      return;
    }

    while (this.runningCount < this.concurrency) {
      const nextItem = this.items.find(
        (item) =>
          item.status === 'idle' &&
          !this.waitingRetries.has(item.id) &&
          !this.abortedItems.has(item.id)
      );

      if (!nextItem) {
        break;
      }

      this.runningCount++;
      this.processItem(nextItem).finally(() => {
        this.runningCount--;
        this.processQueue();
      });
    }

    this.checkQueueComplete();
  }

  private async processItem(item: QueueItemInternal): Promise<void> {
    const abortController = new AbortController();
    item.abortController = abortController;
    const signal = abortController.signal;

    try {
      if (signal.aborted || this.abortedItems.has(item.id)) {
        this.setItemStatus(item, 'error', { error: 'Upload aborted' });
        return;
      }

      // 1. Downscaling
      this.setItemStatus(item, 'downscaling');
      const downscaleResult = await downscaleImageIfNeeded(item.file);
      if (signal.aborted || this.abortedItems.has(item.id)) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
      if (downscaleResult.downscaled) {
        item.file = downscaleResult.file;
        item.sizeBytes = downscaleResult.file.size;
        item.originalName = downscaleResult.file.name;
      }

      // 2. Hashing
      this.setItemStatus(item, 'hashing');
      const buffer = await item.file.arrayBuffer();
      if (signal.aborted || this.abortedItems.has(item.id)) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
      const sha256 = await computeSha256(buffer);
      if (signal.aborted || this.abortedItems.has(item.id)) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      // 3. Preparing
      this.setItemStatus(item, 'preparing');
      if (!this.options.prepareUploads) {
        throw new Error('prepareUploads handler is not configured');
      }

      const prepareRes = await this.options.prepareUploads(this.clientId, [
        {
          originalName: item.originalName,
          sizeBytes: item.sizeBytes,
          mimeType: item.file.type || 'application/octet-stream',
          sha256,
          periodFp: item.periodFp,
        },
      ]);
      if (signal.aborted || this.abortedItems.has(item.id)) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      // Check for duplicate
      const duplicate = prepareRes.duplicates?.find(
        (d) => d.sha256 === sha256 || d.originalName === item.originalName
      );
      if (duplicate) {
        this.setItemProgress(item, 100);
        this.setItemStatus(item, 'duplicate', {
          documentId: duplicate.existingDocumentId,
        });
        return;
      }

      // Check for rejection
      const rejected = prepareRes.rejected?.find(
        (r) => r.originalName === item.originalName
      );
      if (rejected) {
        this.setItemStatus(item, 'error', { error: rejected.reason });
        return;
      }

      const prepared = prepareRes.prepared?.find(
        (p) => p.originalName === item.originalName
      );
      if (!prepared) {
        throw new Error(`Upload preparation failed for ${item.originalName}`);
      }

      item.prepared = prepared;
      item.documentId = prepared.documentId;

      // 4. Uploading
      this.setItemStatus(item, 'uploading');
      const uploadFn = this.options.uploadFn ?? defaultUploadFn;

      await uploadFn(
        prepared.signedUploadUrl,
        item.file,
        (percent) => {
          this.setItemProgress(item, percent);
        },
        signal
      );

      if (signal.aborted || this.abortedItems.has(item.id)) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      // 5. Confirming
      this.setItemStatus(item, 'confirming');
      if (this.options.confirmUpload) {
        const confirmRes = await this.options.confirmUpload(prepared.documentId);
        if (signal.aborted || this.abortedItems.has(item.id)) {
          throw new DOMException('Upload aborted', 'AbortError');
        }
        if (confirmRes && confirmRes.success === false) {
          throw new Error(confirmRes.error || 'Upload confirmation failed');
        }
      }

      // 6. Done
      this.setItemProgress(item, 100);
      this.setItemStatus(item, 'done', { documentId: prepared.documentId });
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string } | null;
      if (
        signal.aborted ||
        this.abortedItems.has(item.id) ||
        errorObj?.name === 'AbortError' ||
        errorObj?.message === 'Upload aborted'
      ) {
        this.setItemStatus(item, 'error', { error: 'Upload aborted' });
        return;
      }

      await this.handleItemError(item, err);
    } finally {
      item.abortController = undefined;
      this.checkQueueComplete();
    }
  }

  private async handleItemError(
    item: QueueItemInternal,
    err: unknown
  ): Promise<void> {
    if (this.isOffline) {
      // Offline: reset to idle so it resumes when back online without consuming retry quota
      this.setItemStatus(item, 'idle');
      return;
    }

    if (item.retryCount < this.maxRetries) {
      item.retryCount++;
      const backoffMs = Math.min(
        this.maxBackoffMs,
        this.initialBackoffMs *
          Math.pow(this.backoffMultiplier, item.retryCount - 1)
      );

      this.waitingRetries.add(item.id);
      this.setItemStatus(item, 'idle');

      await this.sleep(backoffMs, item.id);
      this.waitingRetries.delete(item.id);

      if (!this.abortedItems.has(item.id) && item.status === 'idle') {
        this.processQueue();
      }
    } else {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Upload failed after retries';
      this.setItemStatus(item, 'error', {
        error: message,
      });
    }
  }

  private sleep(ms: number, itemId: string): Promise<void> {
    return new Promise((resolve) => {
      if (ms <= 0) {
        resolve();
      } else {
        const timer = setTimeout(() => {
          this.retryTimers.delete(itemId);
          resolve();
        }, ms);
        this.retryTimers.set(itemId, timer);
      }
    });
  }

  private checkQueueComplete(): void {
    if (this.items.length === 0) return;

    const isComplete = this.items.every(
      (i) =>
        i.status === 'done' || i.status === 'duplicate' || i.status === 'error'
    );

    if (
      isComplete &&
      this.runningCount === 0 &&
      this.waitingRetries.size === 0
    ) {
      if (!this.hasCompletedBatch) {
        this.hasCompletedBatch = true;
        this.options.onQueueComplete?.();
      }
    }
  }
}

export function createUploadQueue(options?: UploadQueueOptions): UploadQueue {
  return new UploadQueue(options);
}
