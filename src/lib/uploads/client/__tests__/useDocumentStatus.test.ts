import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import {
  useDocumentStatus,
  DocumentStatusPoller,
  hasPendingDocuments,
  isFinalStatus,
  isPendingStatus,
  FINAL_STATUSES,
  NON_FINAL_STATUSES,
  DEFAULT_POLL_INTERVAL_MS,
  type UseDocumentStatusOptions,
  type MinimalDocumentItem,
} from '../useDocumentStatus';
import type { DocStatus } from '../../types';

// ============================================================================
// Mock Document and Visibility Harness
// ============================================================================
let mockVisibilityState: DocumentVisibilityState = 'visible';
let visibilityListeners: Array<() => void> = [];

const mockDocument = {
  get visibilityState(): DocumentVisibilityState {
    return mockVisibilityState;
  },
  addEventListener(event: string, handler: () => void) {
    if (event === 'visibilitychange') {
      visibilityListeners.push(handler);
    }
  },
  removeEventListener(event: string, handler: () => void) {
    if (event === 'visibilitychange') {
      visibilityListeners = visibilityListeners.filter((h) => h !== handler);
    }
  },
  dispatchEvent(event: { type: string }) {
    if (event?.type === 'visibilitychange') {
      for (const listener of [...visibilityListeners]) {
        listener();
      }
    }
  },
};

// ============================================================================
// Standard React Hook Simulation Harness
// Provides renderHook simulation for testing hooks in Vitest Node environment
// without requiring external DOM dependencies.
// ============================================================================
interface RenderHookResult<TProps, TResult> {
  result: { current: TResult };
  rerender: (newProps?: TProps) => void;
  unmount: () => void;
}

type EffectCleanup = (() => void) | void;
type EffectCallback = () => EffectCleanup;

function renderHook<TProps, TResult>(
  hookFn: (props: TProps) => TResult,
  options?: { initialProps?: TProps }
): RenderHookResult<TProps, TResult> {
  let currentProps = options?.initialProps as TProps;
  const result = { current: undefined as unknown as TResult };
  let isMounted = true;

  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const cleanups: EffectCleanup[] = [];
  const effectPrevDeps: Array<readonly unknown[] | undefined> = [];

  let stateIdx = 0;
  let refIdx = 0;
  let effectIdx = 0;
  const pendingEffects: Array<{
    idx: number;
    effect: EffectCallback;
    deps?: readonly unknown[];
  }> = [];

  const areDepsEqual = (
    prev?: readonly unknown[],
    next?: readonly unknown[]
  ): boolean => {
    if (!prev || !next) return false;
    if (prev.length !== next.length) return false;
    return prev.every((val, i) => Object.is(val, next[i]));
  };

  const dispatcher = {
    useState<S>(
      initial: S | (() => S)
    ): [S, (action: S | ((prev: S) => S)) => void] {
      const idx = stateIdx++;
      if (states.length <= idx) {
        states.push(
          typeof initial === 'function' ? (initial as () => S)() : initial
        );
      }
      const setState = (action: S | ((prev: S) => S)) => {
        if (!isMounted) return;
        const prev = states[idx] as S;
        const next =
          typeof action === 'function'
            ? (action as (p: S) => S)(prev)
            : action;
        if (!Object.is(prev, next)) {
          states[idx] = next;
          render();
        }
      };
      return [states[idx] as S, setState];
    },
    useRef<T>(initial: T): { current: T } {
      const idx = refIdx++;
      if (refs.length <= idx) {
        refs.push({ current: initial });
      }
      return refs[idx] as { current: T };
    },
    useEffect(effect: EffectCallback, deps?: readonly unknown[]) {
      const idx = effectIdx++;
      pendingEffects.push({ idx, effect, deps });
    },
    useCallback<T extends (...args: never[]) => unknown>(fn: T): T {
      return fn;
    },
    useMemo<T>(fn: () => T): T {
      return fn();
    },
  };

  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        H: unknown;
      };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

  function render(props?: TProps) {
    if (!isMounted) return;
    if (props !== undefined) {
      currentProps = props;
    }

    stateIdx = 0;
    refIdx = 0;
    effectIdx = 0;
    pendingEffects.length = 0;

    const prevDispatcher = internals.H;
    internals.H = dispatcher;
    try {
      result.current = hookFn(currentProps);
    } finally {
      internals.H = prevDispatcher;
    }

    // Run effects whose dependencies changed
    for (const item of pendingEffects) {
      const prevDeps = effectPrevDeps[item.idx];
      const shouldRun =
        prevDeps === undefined || !areDepsEqual(prevDeps, item.deps);

      if (shouldRun) {
        if (typeof cleanups[item.idx] === 'function') {
          cleanups[item.idx]!();
        }
        effectPrevDeps[item.idx] = item.deps;
        cleanups[item.idx] = item.effect();
      }
    }
  }

  render(currentProps);

  return {
    result,
    rerender(newProps?: TProps) {
      render(newProps);
    },
    unmount() {
      if (!isMounted) return;
      isMounted = false;
      for (const cleanup of cleanups) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }
      cleanups.length = 0;
    },
  };
}

// ============================================================================
// Tests
// ============================================================================
describe('useDocumentStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockVisibilityState = 'visible';
    visibilityListeners = [];
    (
      globalThis as unknown as { document: Document | undefined }
    ).document = mockDocument as unknown as Document;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (globalThis as unknown as { document: Document | undefined }).document;
  });

  describe('Status categorization helpers', () => {
    it('correctly categorizes final statuses', () => {
      expect(FINAL_STATUSES).toEqual(['done', 'failed', 'needs_review']);
      expect(isFinalStatus('done')).toBe(true);
      expect(isFinalStatus('failed')).toBe(true);
      expect(isFinalStatus('needs_review')).toBe(true);
      expect(isFinalStatus('uploaded')).toBe(false);
      expect(isFinalStatus('queued')).toBe(false);
      expect(isFinalStatus('processing')).toBe(false);
    });

    it('correctly categorizes non-final / pending statuses', () => {
      expect(NON_FINAL_STATUSES).toEqual(['uploaded', 'queued', 'processing']);
      expect(isPendingStatus('uploaded')).toBe(true);
      expect(isPendingStatus('queued')).toBe(true);
      expect(isPendingStatus('processing')).toBe(true);
      expect(isPendingStatus('done')).toBe(false);
      expect(isPendingStatus('failed')).toBe(false);
      expect(isPendingStatus('needs_review')).toBe(false);
    });

    it('hasPendingDocuments identifies pending vs final lists', () => {
      expect(hasPendingDocuments([])).toBe(false);
      expect(hasPendingDocuments(null)).toBe(false);
      expect(hasPendingDocuments(undefined)).toBe(false);
      expect(
        hasPendingDocuments([
          { status: 'done' },
          { status: 'failed' },
          { status: 'needs_review' },
        ])
      ).toBe(false);
      expect(
        hasPendingDocuments([{ status: 'done' }, { status: 'uploaded' }])
      ).toBe(true);
      expect(
        hasPendingDocuments([{ status: 'queued' }, { status: 'done' }])
      ).toBe(true);
      expect(hasPendingDocuments([{ status: 'processing' }])).toBe(true);
    });
  });

  describe('1. Polls when pending documents exist', () => {
    it('polls at default 5s interval when pending documents exist', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([
        { id: 'doc-1', status: 'uploaded' },
      ]);
      const onUpdate = vi.fn();

      const { result } = renderHook(
        (props: UseDocumentStatusOptions<MinimalDocumentItem>) =>
          useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' }],
            fetchStatus,
            onUpdate,
          },
        }
      );

      expect(result.current.isPolling).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(fetchStatus).toHaveBeenCalledTimes(0);

      // Advance by 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      expect(fetchStatus).toHaveBeenCalledWith('client-1', ['doc-1']);
      expect(onUpdate).toHaveBeenCalledWith([
        { id: 'doc-1', status: 'uploaded' },
      ]);

      // Advance by another 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
    });

    it('polls for documents in queued or processing states', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-abc',
            documents: [
              { id: 'doc-q', status: 'queued' as DocStatus },
              { id: 'doc-p', status: 'processing' as DocStatus },
              { id: 'doc-d', status: 'done' as DocStatus },
            ],
            fetchStatus,
          },
        }
      );

      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      // Only passes the pending document IDs ('doc-q', 'doc-p')
      expect(fetchStatus).toHaveBeenCalledWith('client-abc', [
        'doc-q',
        'doc-p',
      ]);
    });

    it('supports custom intervalMs', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
            intervalMs: 2500,
          },
        }
      );

      await vi.advanceTimersByTimeAsync(2400);
      expect(fetchStatus).toHaveBeenCalledTimes(0);

      await vi.advanceTimersByTimeAsync(100);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });

    it('allows manual trigger via refetch()', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
          },
        }
      );

      expect(fetchStatus).toHaveBeenCalledTimes(0);

      // Trigger manual refetch
      await result.current.refetch();
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Does NOT poll when all documents are final', () => {
    it('does not poll when document list is empty', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [],
            fetchStatus,
          },
        }
      );

      expect(result.current.isPolling).toBe(false);
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);
    });

    it('does not poll when all documents are in final states (done, failed, needs_review)', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [
              { id: 'doc-1', status: 'done' as DocStatus },
              { id: 'doc-2', status: 'failed' as DocStatus },
              { id: 'doc-3', status: 'needs_review' as DocStatus },
            ],
            fetchStatus,
          },
        }
      );

      expect(result.current.isPolling).toBe(false);
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);
    });

    it('stops polling when documents transition from pending to final', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result, rerender } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
          },
        }
      );

      expect(result.current.isPolling).toBe(true);

      // 1st poll occurs at 5s
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);

      // Update documents to final state
      rerender({
        clientId: 'client-1',
        documents: [{ id: 'doc-1', status: 'done' as DocStatus }],
        fetchStatus,
      });

      expect(result.current.isPolling).toBe(false);

      // Advance by another 30s: no further polling occurs
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });

    it('does not poll if enabled is false or clientId is empty', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result: res1 } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: '',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
          },
        }
      );
      expect(res1.current.isPolling).toBe(false);

      const { result: res2 } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
            enabled: false,
          },
        }
      );
      expect(res2.current.isPolling).toBe(false);

      await vi.advanceTimersByTimeAsync(20000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);
    });
  });

  describe('3. Pauses when tab is hidden and resumes when visible', () => {
    it('pauses polling when tab is hidden and resumes immediately when visible', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'processing' as DocStatus }],
            fetchStatus,
          },
        }
      );

      expect(result.current.isPolling).toBe(true);
      expect(result.current.isPaused).toBe(false);

      // Tab becomes hidden before first interval completes
      mockVisibilityState = 'hidden';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });

      expect(result.current.isPaused).toBe(true);
      expect(result.current.isPolling).toBe(false);

      // Advance time while hidden: no poll occurs
      await vi.advanceTimersByTimeAsync(20000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);

      // Tab becomes visible: should resume immediately!
      mockVisibilityState = 'visible';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });

      expect(result.current.isPaused).toBe(false);
      expect(result.current.isPolling).toBe(true);

      // Immediate fetch executed on visibilitychange
      expect(fetchStatus).toHaveBeenCalledTimes(1);

      // Next poll schedules at regular interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
    });

    it('does not poll on mount if page is initially hidden until tab becomes visible', async () => {
      mockVisibilityState = 'hidden';
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
          },
        }
      );

      expect(result.current.isPaused).toBe(true);
      expect(result.current.isPolling).toBe(false);

      await vi.advanceTimersByTimeAsync(20000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);

      // Switch to visible
      mockVisibilityState = 'visible';
      mockDocument.dispatchEvent({ type: 'visibilitychange' });

      expect(result.current.isPaused).toBe(false);
      expect(result.current.isPolling).toBe(true);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Handles errors with backoff', () => {
    it('exponentially doubles interval up to 60s on failure, and resets to default on success', async () => {
      let failCount = 0;
      const fetchStatus = vi.fn().mockImplementation(() => {
        failCount++;
        if (failCount <= 5) {
          return Promise.reject(new Error(`Attempt ${failCount} failed`));
        }
        return Promise.resolve([{ id: 'doc-1', status: 'uploaded' }]);
      });

      const { result } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
            intervalMs: 5000,
            maxIntervalMs: 60000,
          },
        }
      );

      // 1st attempt at 5000ms: fails -> interval doubles to 10000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);
      expect(result.current.error?.message).toBe('Attempt 1 failed');
      expect(result.current.currentInterval).toBe(10000);

      // Advance by 5000ms: should NOT have polled yet (10s backoff)
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);

      // Advance another 5000ms (total 10000ms): 2nd attempt fails -> interval doubles to 20000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
      expect(result.current.currentInterval).toBe(20000);

      // Advance 20000ms: 3rd attempt fails -> interval doubles to 40000ms
      await vi.advanceTimersByTimeAsync(20000);
      expect(fetchStatus).toHaveBeenCalledTimes(3);
      expect(result.current.currentInterval).toBe(40000);

      // Advance 40000ms: 4th attempt fails -> interval capped at 60000ms
      await vi.advanceTimersByTimeAsync(40000);
      expect(fetchStatus).toHaveBeenCalledTimes(4);
      expect(result.current.currentInterval).toBe(60000);

      // Advance 60000ms: 5th attempt fails -> interval stays capped at 60000ms
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchStatus).toHaveBeenCalledTimes(5);
      expect(result.current.currentInterval).toBe(60000);

      // Advance 60000ms: 6th attempt SUCCEEDS!
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchStatus).toHaveBeenCalledTimes(6);
      expect(result.current.error).toBeNull();
      // Resets back to initial 5000ms default interval
      expect(result.current.currentInterval).toBe(DEFAULT_POLL_INTERVAL_MS);

      // Next poll should occur at 5000ms (verifying the reset took effect)
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(7);
    });
  });

  describe('5. Cleanup on unmount', () => {
    it('clears timer and removes event listeners on unmount', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);

      const { unmount } = renderHook(
        (props) => useDocumentStatus(props),
        {
          initialProps: {
            clientId: 'client-1',
            documents: [{ id: 'doc-1', status: 'uploaded' as DocStatus }],
            fetchStatus,
          },
        }
      );

      expect(visibilityListeners.length).toBe(1);

      // Unmount hook
      unmount();

      expect(visibilityListeners.length).toBe(0);

      // Advance timers after unmount: no polling should occur
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchStatus).toHaveBeenCalledTimes(0);
    });
  });

  describe('DocumentStatusPoller class direct tests', () => {
    it('handles direct start, stop, pause, resume and backoff', async () => {
      const fetchStatus = vi.fn().mockResolvedValue([]);
      const poller = new DocumentStatusPoller({
        clientId: 'client-direct',
        documents: [{ id: 'd-1', status: 'uploaded' as DocStatus }],
        fetchStatus,
        intervalMs: 5000,
      });

      expect(poller.getState().isPolling).toBe(true);

      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);

      poller.pause();
      expect(poller.getState().isPaused).toBe(true);
      expect(poller.getState().isPolling).toBe(false);

      await vi.advanceTimersByTimeAsync(15000);
      expect(fetchStatus).toHaveBeenCalledTimes(1);

      poller.resume();
      expect(poller.getState().isPaused).toBe(false);
      expect(fetchStatus).toHaveBeenCalledTimes(2);

      poller.destroy();
      expect(poller.isDestroyed()).toBe(true);

      await vi.advanceTimersByTimeAsync(15000);
      expect(fetchStatus).toHaveBeenCalledTimes(2);
    });
  });
});
