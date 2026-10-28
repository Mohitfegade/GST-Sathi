import { useEffect, useState, useCallback } from 'react';
import type { DocStatus, DocumentListItem } from '../types';

/** Final document statuses that do not require further polling */
export const FINAL_STATUSES: readonly DocStatus[] = [
  'done',
  'failed',
  'needs_review',
] as const;

/** Non-final document statuses that trigger status polling */
export const NON_FINAL_STATUSES: readonly DocStatus[] = [
  'uploaded',
  'queued',
  'processing',
] as const;

export const DEFAULT_POLL_INTERVAL_MS = 5000;
export const MAX_POLL_INTERVAL_MS = 60000;

export type FinalDocStatus = (typeof FINAL_STATUSES)[number];
export type PendingDocStatus = (typeof NON_FINAL_STATUSES)[number];

export interface MinimalDocumentItem {
  id: string;
  status: DocStatus;
}

/** Check if a status is terminal / final */
export function isFinalStatus(status: DocStatus): boolean {
  return FINAL_STATUSES.includes(status as FinalDocStatus);
}

/** Check if a status is pending / non-final */
export function isPendingStatus(status: DocStatus): boolean {
  return NON_FINAL_STATUSES.includes(status as PendingDocStatus);
}

/** Returns true if any document in the list is in a non-final status */
export function hasPendingDocuments(
  documents?: Array<{ status: DocStatus }> | null
): boolean {
  if (!documents || documents.length === 0) return false;
  return documents.some((doc) => !isFinalStatus(doc.status));
}

export interface UseDocumentStatusOptions<
  T extends MinimalDocumentItem = DocumentListItem,
> {
  clientId: string;
  documents: T[];
  onUpdate?: (updatedDocuments: T[]) => void;
  intervalMs?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
  refreshAction?: (
    clientId: string,
    pendingDocumentIds: string[]
  ) => Promise<T[] | void> | T[] | void;
  fetchStatus?: (
    clientId: string,
    pendingDocumentIds: string[]
  ) => Promise<T[] | void> | T[] | void;
}

export interface PollerState {
  isPolling: boolean;
  isPaused: boolean;
  error: Error | null;
  currentInterval: number;
}

export interface UseDocumentStatusReturn extends PollerState {
  refetch: () => Promise<void>;
}

/**
 * Core poller controller handling timers, tab visibility, exponential backoff,
 * and status queries. Can be used standalone or wrapped in React hooks.
 */
export class DocumentStatusPoller<
  T extends MinimalDocumentItem = DocumentListItem,
> {
  private options: UseDocumentStatusOptions<T>;
  private isPollingState = false;
  private isPausedState = false;
  private errorState: Error | null = null;
  private currentIntervalMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isFetching = false;
  private isDestroyedState = false;
  private subscribers = new Set<(state: PollerState) => void>();

  constructor(
    options: UseDocumentStatusOptions<T>,
    onStateChange?: (state: PollerState) => void
  ) {
    this.options = options;
    this.currentIntervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    if (onStateChange) {
      this.subscribers.add(onStateChange);
    }

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    if (this.shouldPoll()) {
      if (this.isHidden()) {
        this.isPausedState = true;
        this.isPollingState = false;
      } else {
        this.isPollingState = true;
        this.isPausedState = false;
        this.scheduleNext(this.currentIntervalMs);
      }
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document === 'undefined' || this.isDestroyedState) return;

    if (document.visibilityState === 'hidden') {
      this.pause();
    } else if (document.visibilityState === 'visible') {
      this.resume();
    }
  }

  public pause(): void {
    if (this.isDestroyedState) return;
    this.clearTimer();
    this.isPausedState = true;
    this.isPollingState = false;
    this.notify();
  }

  public resume(): void {
    if (this.isDestroyedState) return;
    this.isPausedState = false;

    if (this.shouldPoll()) {
      this.isPollingState = true;
      this.notify();
      // Resume immediately on visibilitychange to 'visible'
      void this.executePoll();
    } else {
      this.isPollingState = false;
      this.notify();
    }
  }

  public shouldPoll(): boolean {
    if (this.isDestroyedState) return false;
    const enabled = this.options.enabled ?? true;
    if (!enabled) return false;
    if (!this.options.clientId) return false;
    return hasPendingDocuments(this.options.documents);
  }

  public isHidden(): boolean {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return true;
    }
    return false;
  }

  public async executePoll(): Promise<void> {
    if (this.isDestroyedState || this.isFetching) return;

    if (!this.shouldPoll()) {
      this.clearTimer();
      this.isPollingState = false;
      this.notify();
      return;
    }

    if (this.isHidden()) {
      this.pause();
      return;
    }

    this.isFetching = true;
    this.clearTimer();

    try {
      const pendingIds = (this.options.documents || [])
        .filter((d) => isPendingStatus(d.status))
        .map((d) => d.id);

      const fetcher = this.options.fetchStatus ?? this.options.refreshAction;
      let updatedDocs: T[] | undefined;

      if (fetcher) {
        const result = await fetcher(this.options.clientId, pendingIds);
        if (Array.isArray(result)) {
          updatedDocs = result as T[];
        }
      } else if (typeof fetch === 'function') {
        const url = `/api/clients/${encodeURIComponent(this.options.clientId)}/documents`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to fetch documents`);
        }
        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : data?.items ?? data?.documents;
        if (Array.isArray(items)) {
          updatedDocs = items as T[];
        }
      }

      if (this.isDestroyedState) return;

      if (updatedDocs && this.options.onUpdate) {
        this.options.onUpdate(updatedDocs);
      }

      // Success: reset interval to default intervalMs, clear error
      this.currentIntervalMs = this.options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
      this.errorState = null;
    } catch (err) {
      if (this.isDestroyedState) return;

      this.errorState = err instanceof Error ? err : new Error(String(err));
      // Exponential backoff: double interval up to maxIntervalMs
      const maxInterval = this.options.maxIntervalMs ?? MAX_POLL_INTERVAL_MS;
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, maxInterval);
    } finally {
      this.isFetching = false;
      if (this.isDestroyedState) return;

      if (this.shouldPoll() && !this.isHidden()) {
        this.isPollingState = true;
        this.scheduleNext(this.currentIntervalMs);
      } else {
        this.isPollingState = false;
      }
      this.notify();
    }
  }

  public updateOptions(newOptions: UseDocumentStatusOptions<T>): void {
    if (this.isDestroyedState) return;

    const prevShouldPoll = this.shouldPoll();
    const prevInterval = this.options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.options = newOptions;
    const nextInterval = this.options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    // Reset base interval if changed and no current error backoff
    if (prevInterval !== nextInterval && this.errorState === null) {
      this.currentIntervalMs = nextInterval;
    }

    const nextShouldPoll = this.shouldPoll();

    if (!nextShouldPoll) {
      this.clearTimer();
      this.isPollingState = false;
      this.isPausedState = false;
      this.notify();
    } else if (!prevShouldPoll && nextShouldPoll) {
      if (this.isHidden()) {
        this.pause();
      } else {
        this.isPollingState = true;
        this.isPausedState = false;
        this.scheduleNext(this.currentIntervalMs);
        this.notify();
      }
    }
  }

  private scheduleNext(delay: number): void {
    this.clearTimer();
    if (this.isDestroyedState) return;
    this.timer = setTimeout(() => {
      void this.executePoll();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public destroy(): void {
    this.isDestroyedState = true;
    this.clearTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.subscribers.clear();
  }

  public isDestroyed(): boolean {
    return this.isDestroyedState;
  }

  public getState(): PollerState {
    return {
      isPolling: this.isPollingState,
      isPaused: this.isPausedState,
      error: this.errorState,
      currentInterval: this.currentIntervalMs,
    };
  }

  public subscribe(listener: (state: PollerState) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    if (this.isDestroyedState) return;
    const state = this.getState();
    for (const listener of this.subscribers) {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in poller subscriber:', e);
      }
    }
  }

  public async refetch(): Promise<void> {
    await this.executePoll();
  }
}

/**
 * React hook to poll document statuses for a client.
 *
 * - Automatically polls when any document is in 'uploaded', 'queued', or 'processing' status.
 * - Pauses polling when all documents are 'done', 'failed', or 'needs_review' (or list is empty).
 * - Pauses polling when tab is hidden (`document.visibilityState === 'hidden'`).
 * - Resumes immediately on 'visibilitychange' when tab becomes visible.
 * - Applies exponential backoff on errors (doubles interval up to 60s, resets on success).
 * - Cleans up timers and event listeners on unmount.
 */
export function useDocumentStatus<
  T extends MinimalDocumentItem = DocumentListItem,
>(options: UseDocumentStatusOptions<T>): UseDocumentStatusReturn {
  const [poller] = useState(() => new DocumentStatusPoller<T>(options));

  const [state, setState] = useState<PollerState>(() => poller.getState());

  useEffect(() => {
    const unsubscribe = poller.subscribe((newState) => {
      setState((prev) => {
        if (
          prev.isPolling === newState.isPolling &&
          prev.isPaused === newState.isPaused &&
          prev.error === newState.error &&
          prev.currentInterval === newState.currentInterval
        ) {
          return prev;
        }
        return newState;
      });
    });

    return () => {
      unsubscribe();
      poller.destroy();
    };
  }, [poller]);

  useEffect(() => {
    poller.updateOptions(options);
  }, [poller, options]);

  const refetch = useCallback(async () => {
    await poller.refetch();
  }, [poller]);

  return {
    ...state,
    refetch,
  };
}

export default useDocumentStatus;
