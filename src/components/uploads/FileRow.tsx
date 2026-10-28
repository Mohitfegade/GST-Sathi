'use client';

import React from 'react';
import type { UploadQueueItem } from '@/lib/uploads/types';
import { ProgressBar } from './ProgressBar';
import { DUPLICATE_MESSAGE, resolveUploadErrorMessage } from '@/lib/uploads/messages';

export interface FileRowProps {
  /** The upload queue item representing this file */
  item: UploadQueueItem;
  /** Callback when user clicks Retry on an errored file */
  onRetry?: (id: string) => void;
  /** Callback when user clicks Remove on a file */
  onRemove?: (id: string) => void;
  /** Viewer role for tailored wording */
  role?: 'accountant' | 'owner' | 'client';
  /** Additional styling class name */
  className?: string;
}

/**
 * Formats byte size into human-readable format (e.g. 1.2 MB, 850 KB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const digitGroup = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const size = bytes / Math.pow(1024, digitGroup);
  const formatted = digitGroup === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${formatted} ${units[digitGroup]}`;
}

/**
 * Returns plain-English wording and border styling for a given upload item status.
 * Never relies on color alone (WCAG 1.4.1).
 */
function getStatusDetails(
  status: UploadQueueItem['status'],
  progress: number,
  errorMessage?: string,
  role: 'accountant' | 'owner' | 'client' = 'accountant'
): { label: string; borderClass: string; description: string } {
  const isOwner = role === 'owner' || role === 'client';

  switch (status) {
    case 'idle':
      return {
        label: 'Waiting',
        borderClass: 'border-2 border-dashed border-line',
        description: 'Waiting in line to be uploaded (dashed border)',
      };
    case 'downscaling':
      return {
        label: isOwner ? 'Optimizing photo' : 'Downscaling image',
        borderClass: 'border-2 border-dotted border-line',
        description: 'Compressing image for fast upload (dotted border)',
      };
    case 'hashing':
      return {
        label: 'Checking file',
        borderClass: 'border-2 border-dotted border-line',
        description: 'Checking file integrity (dotted border)',
      };
    case 'preparing':
      return {
        label: 'Preparing',
        borderClass: 'border-2 border-dotted border-line',
        description: 'Setting up secure upload (dotted border)',
      };
    case 'uploading':
      return {
        label: `Sending ${progress > 0 ? `${progress}%` : ''}`.trim(),
        borderClass: 'border-2 border-dotted border-accent',
        description: `Currently uploading: ${progress}% complete (dotted border)`,
      };
    case 'confirming':
      return {
        label: isOwner ? 'Verifying photo' : 'Verifying',
        borderClass: 'border-2 border-double border-accent',
        description: 'Verifying file on server (double border)',
      };
    case 'done':
      return {
        label: isOwner ? 'Checked' : 'Sent',
        borderClass: 'border-2 border-solid border-line',
        description: 'Upload complete and verified (solid border)',
      };
    case 'duplicate':
      return {
        label: DUPLICATE_MESSAGE,
        borderClass: 'border-2 border-solid border-ink',
        description: `${DUPLICATE_MESSAGE} (solid dark border)`,
      };
    case 'error':
      return {
        label: errorMessage ? resolveUploadErrorMessage(errorMessage) : 'Could not send',
        borderClass: 'border-2 border-ridge border-ink',
        description: 'Upload failed (ridge border)',
      };
    default:
      return {
        label: status,
        borderClass: 'border border-solid border-line',
        description: status,
      };
  }
}

/**
 * FileRow displays a single file in the upload queue.
 * Displays file name, human-readable size (e.g. 1.2 MB), status indicator (with plain-English
 * words and border styling, not color alone), and progress bar if uploading.
 * Shows "Retry" button on error and "Remove" button with 48px minimum touch targets.
 * Shows "You already sent this bill" if duplicate.
 */
export function FileRow({
  item,
  onRetry,
  onRemove,
  role = 'accountant',
  className = '',
}: FileRowProps) {
  const isUploading =
    item.status === 'downscaling' ||
    item.status === 'hashing' ||
    item.status === 'preparing' ||
    item.status === 'uploading' ||
    item.status === 'confirming';

  const isDuplicate = item.status === 'duplicate';
  const isError = item.status === 'error';
  const statusDetails = getStatusDetails(
    item.status,
    item.progress,
    item.error,
    role
  );

  return (
    <div
      role="listitem"
      className={`bg-surface border border-line rounded-[8px] p-4 transition-all ${className}`.trim()}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* File information */}
        <div className="min-w-0 flex-1">
          <p
            className="text-base font-semibold text-ink truncate"
            title={item.originalName}
          >
            {item.originalName}
          </p>
          <p className="text-sm text-muted mt-0.5">
            {formatFileSize(item.sizeBytes)}
          </p>

          {/* Duplicate plain-English notice */}
          {isDuplicate && (
            <p className="text-sm font-medium text-ink mt-1.5 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-full bg-ink"
              />
              {DUPLICATE_MESSAGE}
            </p>
          )}

          {/* Error detail message if error */}
          {isError && item.error && (
            <p className="text-sm text-ink mt-1.5 font-medium">
              {resolveUploadErrorMessage(item.error)}
            </p>
          )}
        </div>

        {/* Status Badge & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:self-center">
          {/* Status Badge using words and border styling (not color alone) */}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-background text-ink ${statusDetails.borderClass}`}
            title={statusDetails.description}
            aria-label={statusDetails.description}
          >
            {statusDetails.label}
          </span>

          {/* Retry Button on Error (Minimum 48px tap target) */}
          {isError && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              aria-label={`Retry uploading ${item.originalName}`}
              className="min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-[8px] text-sm font-medium bg-background border border-line text-ink hover:bg-surface active:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry
            </button>
          )}

          {/* Remove / Cancel Button (Minimum 48px tap target) */}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.originalName}`}
              className="min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-[8px] text-sm font-medium bg-background border border-line text-ink hover:bg-surface active:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar when uploading */}
      {isUploading && (
        <div className="mt-3">
          <ProgressBar
            progress={item.progress}
            label={statusDetails.label}
            aria-label={`Upload progress for ${item.originalName}`}
            showLabel
          />
        </div>
      )}
    </div>
  );
}

export default FileRow;
