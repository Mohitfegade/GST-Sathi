'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { UploadQueueItem, PrepareUploadFile, PrepareUploadsResult } from '@/lib/uploads/types';
import { MAX_FILES_PER_BATCH, MAX_FILE_SIZE_BYTES } from '@/lib/uploads/limits';
import {
  BATCH_TOO_LARGE_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  NETWORK_OFFLINE_MESSAGE,
} from '@/lib/uploads/messages';
import { UploadButton } from './UploadButton';
import { FileRow } from './FileRow';
import { UploadQueue, createUploadQueue } from '@/lib/uploads/client/queue';

export interface UploadPanelProps {
  /** Target client UUID */
  clientId: string;
  /** Optional return period in MMYYYY format (e.g. '102026') */
  periodFp?: string | null;
  /** Callback fired when all items in a batch complete uploading */
  onUploadComplete?: () => void;
  /** Role context for tailored wording */
  role?: 'accountant' | 'owner' | 'client';
  /** Additional styling class name */
  className?: string;
  /** Optional custom prepareUploads override */
  prepareUploads?: (
    clientId: string,
    files: PrepareUploadFile[]
  ) => Promise<PrepareUploadsResult>;
  /** Optional custom confirmUpload override */
  confirmUpload?: (
    documentId: string
  ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * UploadPanel provides an accessible, mobile-first upload zone with drag-and-drop,
 * batch progress summary, per-file rows with retry/remove, and queue orchestration.
 *
 * Adheres strictly to design tokens (zero hex codes) and product rules:
 * - Desktop drag-and-drop zone with border-dashed border-line, highlights on drag over.
 * - "Add bills" button prominently displayed.
 * - Plain summary line: e.g. "4 of 5 sent" or "All 5 bills sent successfully".
 * - Renders list of FileRow items.
 * - Mobile-first with minimum 48px tap targets.
 */
export function UploadPanel({
  clientId,
  periodFp,
  onUploadComplete,
  role = 'accountant',
  className = '',
  prepareUploads: customPrepareUploads,
  confirmUpload: customConfirmUpload,
}: UploadPanelProps) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const queueRef = useRef<UploadQueue | null>(null);
  const onUploadCompleteRef = useRef(onUploadComplete);

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  // Initialize or reconfigure UploadQueue
  useEffect(() => {
    // Default prepareUploads adapter delegating to server action if available
    const defaultPrepare = async (
      cid: string,
      files: PrepareUploadFile[]
    ): Promise<PrepareUploadsResult> => {
      if (customPrepareUploads) {
        return customPrepareUploads(cid, files);
      }
      try {
        const actions = await import('@/lib/uploads/actions');
        if (typeof actions.prepareUploads === 'function') {
          const res = await actions.prepareUploads(cid, files);
          if (res) {
            if ('ok' in res) {
              if (!res.ok) {
                throw new Error(res.message || 'Failed to prepare uploads');
              }
              return res.data;
            }
            if ('success' in res && !(res as { success: boolean }).success) {
              throw new Error((res as { error?: string }).error || 'Failed to prepare uploads');
            }
            if ('data' in res) {
              return (res as { data: PrepareUploadsResult }).data;
            }
          }
          return res as unknown as PrepareUploadsResult;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload preparation failed';
        throw new Error(message);
      }
      throw new Error('Upload preparation is not configured');
    };

    // Default confirmUpload adapter delegating to server action if available
    const defaultConfirm = async (
      docId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (customConfirmUpload) {
        return customConfirmUpload(docId);
      }
      try {
        const actions = await import('@/lib/uploads/actions');
        if (typeof actions.confirmUpload === 'function') {
          const res = await actions.confirmUpload(docId);
          if (res) {
            if ('ok' in res) {
              if (!res.ok) {
                return { success: false, error: res.message || 'Failed to confirm upload' };
              }
              return { success: true };
            }
            if ('success' in res && !(res as { success: boolean }).success) {
              return { success: false, error: (res as { error?: string }).error || 'Failed to confirm upload' };
            }
            return { success: true };
          }
          return { success: true };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Confirmation error';
        return { success: false, error: message };
      }
      return { success: true };
    };

    const queue = createUploadQueue({
      clientId,
      periodFp,
      prepareUploads: defaultPrepare,
      confirmUpload: defaultConfirm,
      onItemUpdate: () => {
        if (queueRef.current) {
          setItems(queueRef.current.getItems());
        }
      },
      onQueueComplete: () => {
        if (queueRef.current) {
          setItems(queueRef.current.getItems());
        }
        onUploadCompleteRef.current?.();
      },
    });

    queueRef.current = queue;

    // Track online/offline status for friendly banner
    const updateOnlineStatus = () => {
      setIsOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    };

    updateOnlineStatus();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      }
      queue.destroy();
      queueRef.current = null;
    };
  }, [clientId, periodFp, customPrepareUploads, customConfirmUpload]);

  // Update clientId if prop changes
  useEffect(() => {
    queueRef.current?.setClientId(clientId);
  }, [clientId]);

  // Add files to queue with limit validations
  const handleFilesSelected = useCallback(
    (selectedFiles: File[]) => {
      setPanelMessage(null);

      if (!selectedFiles || selectedFiles.length === 0) return;

      // Validate batch limit
      if (selectedFiles.length > MAX_FILES_PER_BATCH) {
        setPanelMessage(BATCH_TOO_LARGE_MESSAGE);
        selectedFiles = selectedFiles.slice(0, MAX_FILES_PER_BATCH);
      }

      // Check for individual file size limits
      const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
      if (oversized.length > 0) {
        setPanelMessage(FILE_TOO_LARGE_MESSAGE);
      }

      if (queueRef.current) {
        queueRef.current.addFiles(selectedFiles, { periodFp });
        setItems(queueRef.current.getItems());
      }
    },
    [periodFp]
  );

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate if leaving the container boundaries
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFilesSelected(Array.from(droppedFiles));
    }
  };

  const handleRetry = useCallback((id: string) => {
    if (queueRef.current) {
      queueRef.current.retry(id);
      setItems(queueRef.current.getItems());
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    if (queueRef.current) {
      queueRef.current.abort(id);
      // Remove from display list
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }, []);

  const handleClearFinished = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.clearCompleted();
      setItems(queueRef.current.getItems());
    }
  }, []);

  // Summary counts and plain-English messaging
  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const duplicateCount = items.filter((i) => i.status === 'duplicate').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const sentCount = doneCount + duplicateCount;
  const activeCount = items.filter(
    (i) =>
      i.status === 'downscaling' ||
      i.status === 'hashing' ||
      i.status === 'preparing' ||
      i.status === 'uploading' ||
      i.status === 'confirming'
  ).length;

  const isAllSent = totalCount > 0 && sentCount === totalCount;
  const isAllProcessed =
    totalCount > 0 && sentCount + errorCount === totalCount;

  // Build the plain summary line
  let summaryLine: string | null = null;
  if (totalCount > 0) {
    if (isAllSent) {
      summaryLine =
        totalCount === 1
          ? 'Bill sent successfully'
          : `All ${totalCount} bills sent successfully`;
    } else if (isAllProcessed && errorCount > 0) {
      summaryLine = `${sentCount} of ${totalCount} sent. ${errorCount} could not be sent.`;
    } else if (activeCount > 0) {
      summaryLine = `Sending ${sentCount + 1} of ${totalCount}...`;
    } else {
      summaryLine = `${sentCount} of ${totalCount} sent`;
    }
  }

  return (
    <section
      aria-label="Upload bills"
      className={`w-full ${className}`.trim()}
    >
      {/* Offline banner notification */}
      {isOffline && (
        <div
          role="status"
          className="mb-4 p-3 rounded-[8px] bg-surface border-2 border-dashed border-ink text-sm font-medium text-ink"
        >
          {NETWORK_OFFLINE_MESSAGE}
        </div>
      )}

      {/* Validation or batch notice */}
      {panelMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-[8px] bg-surface border border-line text-sm text-ink font-medium"
        >
          {panelMessage}
        </div>
      )}

      {/* Drag-and-drop dropzone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-6 md:p-10 rounded-[12px] border-2 border-dashed transition-colors text-center ${
          isDragging
            ? 'border-accent bg-surface'
            : 'border-line bg-background hover:bg-surface'
        }`}
      >
        <div className="flex flex-col items-center max-w-md mx-auto">
          {/* Decorative upload icon */}
          <div
            aria-hidden="true"
            className="w-12 h-12 rounded-full bg-surface border border-line flex items-center justify-center text-ink mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h3 className="text-lg md:text-xl font-bold text-ink mb-2">
            Add your purchase bills
          </h3>

          <p className="text-sm text-muted mb-6">
            Drag and drop bills here, or tap below to pick from your camera or files.
          </p>

          {/* Prominent UploadButton */}
          <UploadButton
            onFilesSelected={handleFilesSelected}
            label="Add bills"
            maxFiles={MAX_FILES_PER_BATCH}
            className="w-full sm:w-auto"
          />

          <p className="text-xs text-muted mt-4">
            JPEG, PNG, WebP or PDF. Up to 10 MB per bill (max 20 bills).
          </p>
        </div>
      </div>

      {/* Upload queue list & summary */}
      {totalCount > 0 && (
        <div className="mt-6 space-y-4">
          {/* Summary Line Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-surface border border-line rounded-[8px]">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full ${
                  isAllSent
                    ? 'bg-ink'
                    : activeCount > 0
                    ? 'bg-accent animate-pulse'
                    : 'bg-muted'
                }`}
              />
              <p className="text-base font-semibold text-ink" role="status">
                {summaryLine}
              </p>
            </div>

            {/* Clear Finished button when done */}
            {isAllProcessed && (
              <button
                type="button"
                onClick={handleClearFinished}
                className="self-start sm:self-auto min-h-[48px] px-3 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear finished
              </button>
            )}
          </div>

          {/* List of FileRows */}
          <div
            role="list"
            aria-label="Uploading files"
            className="space-y-2.5"
          >
            {items.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onRetry={handleRetry}
                onRemove={handleRemove}
                role={role}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default UploadPanel;
