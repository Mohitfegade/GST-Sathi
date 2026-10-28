'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/lib/auth/types';
import type {
  DocStatus,
  DocumentListItem,
  DocumentStatusCounts,
} from '@/lib/uploads/types';
import { getStatusBadgeStyle } from '@/lib/uploads/status-labels';
import { DELETE_CONFIRMATION_MESSAGE } from '@/lib/uploads/messages';
import { deleteDocument } from '@/lib/uploads/actions';
import { useDocumentStatus } from '@/lib/uploads/client/useDocumentStatus';
import { parseFp } from '@/lib/period';

export interface DocumentListProps {
  /** Target client UUID */
  clientId: string;
  /** Initial documents loaded from the server */
  initialDocuments?: DocumentListItem[];
  /** Aggregate status counts from server */
  statusCounts?: DocumentStatusCounts;
  /** Initial status filter */
  initialStatus?: DocStatus | 'all';
  /** Initial return period filter in MMYYYY format */
  initialMonth?: string | 'all';
  /** Server action to generate 5-minute signed preview URL */
  onPreviewUrl?: (storagePath: string) => Promise<string | null>;
  /** Optional custom delete action override */
  onDeleteDocument?: (
    documentId: string
  ) => Promise<ActionResult<{ id: string; deleted: boolean }>>;
  /** Additional styling class name */
  className?: string;
}

type FilterStatus = 'all' | 'queued' | 'processing' | 'needs_review' | 'done' | 'failed';

const STATUS_FILTERS: Array<{ id: FilterStatus; label: string; countKey?: keyof DocumentStatusCounts }> = [
  { id: 'all', label: 'All', countKey: 'total' },
  { id: 'queued', label: 'Queued', countKey: 'queued' },
  { id: 'processing', label: 'Reading', countKey: 'processing' },
  { id: 'needs_review', label: 'Needs review', countKey: 'needsReview' },
  { id: 'done', label: 'Done', countKey: 'done' },
  { id: 'failed', label: 'Failed', countKey: 'failed' },
];

/**
 * Formats byte size into human-readable format (e.g. 1.2 MB, 850 KB).
 */
function formatFileSize(bytes: number): string {
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
 * Formats a return period "fp" (MMYYYY) into plain English month and year.
 */
function formatPeriod(periodFp?: string | null): string {
  if (!periodFp || periodFp.length !== 6) return '—';
  try {
    const { monthName, year } = parseFp(periodFp);
    return `${monthName} ${year}`;
  } catch {
    return periodFp;
  }
}

/**
 * Formats timestamp into readable date and time.
 */
function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

/**
 * DocumentList component lists purchase bills for an accountant view:
 * - Desktop: responsive table (`hidden md:table`).
 * - Mobile: stacked cards (`block md:hidden`).
 * - Filters: Status (All, Queued, Reading, Needs review, Done, Failed) and Month.
 * - Preview / Download: triggers createPreviewUrl action (opens signed URL in new tab expiring in 5 minutes).
 * - Delete document: soft delete with plain confirmation modal ("Hide this bill? It will be removed from this client's list.").
 * - Status badge: words and distinct border styles (not color alone).
 * - Minimum 48px tap targets on all interactive items.
 */
export function DocumentList({
  clientId,
  initialDocuments = [],
  statusCounts: initialStatusCounts,
  initialStatus = 'all',
  initialMonth = 'all',
  onPreviewUrl,
  onDeleteDocument,
  className = '',
}: DocumentListProps) {
  const router = useRouter();
  const [prevInitialDocs, setPrevInitialDocs] = useState(initialDocuments);
  const [documents, setDocuments] = useState<DocumentListItem[]>(initialDocuments);

  // Sync state if initialDocuments changes from parent re-render (React-recommended pattern)
  if (initialDocuments !== prevInitialDocs) {
    setPrevInitialDocs(initialDocuments);
    setDocuments(initialDocuments);
  }

  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>(
    (initialStatus as FilterStatus) || 'all'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || 'all');

  // Preview state
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Soft delete modal state
  const [documentToDelete, setDocumentToDelete] = useState<DocumentListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        setDocumentToDelete(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentToDelete, isDeleting]);

  // Live polling for non-final documents
  useDocumentStatus({
    clientId,
    documents,
    onUpdate: (updatedDocs) => {
      setDocuments((prev) => {
        const docMap = new Map(prev.map((d) => [d.id, d]));
        for (const doc of updatedDocs) {
          docMap.set(doc.id, doc);
        }
        return Array.from(docMap.values());
      });
    },
    refreshAction: async () => {
      router.refresh();
    },
  });

  // Extract distinct return periods present in the documents
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      if (doc.periodFp && doc.periodFp.length === 6) {
        set.add(doc.periodFp);
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [documents]);

  // Dynamically compute status counts reflecting live state
  const liveStatusCounts = useMemo(() => {
    const counts = {
      total: documents.length,
      uploaded: 0,
      queued: 0,
      processing: 0,
      needsReview: 0,
      done: 0,
      failed: 0,
    };

    for (const d of documents) {
      if (d.status === 'uploaded') {
        counts.uploaded += 1;
        counts.queued += 1; // Group unconfirmed with queued for display
      } else if (d.status === 'queued') {
        counts.queued += 1;
      } else if (d.status === 'processing') {
        counts.processing += 1;
      } else if (d.status === 'needs_review') {
        counts.needsReview += 1;
      } else if (d.status === 'done') {
        counts.done += 1;
      } else if (d.status === 'failed') {
        counts.failed += 1;
      }
    }

    return counts;
  }, [documents]);

  // Apply filters
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'queued') {
          if (doc.status !== 'queued' && doc.status !== 'uploaded') {
            return false;
          }
        } else if (doc.status !== selectedStatus) {
          return false;
        }
      }

      // Month filter
      if (selectedMonth !== 'all') {
        if (doc.periodFp !== selectedMonth) {
          return false;
        }
      }

      return true;
    });
  }, [documents, selectedStatus, selectedMonth]);

  // Handle preview and download signed URL (expires in 5 minutes)
  const handlePreview = useCallback(
    async (doc: DocumentListItem) => {
      try {
        setLoadingPreviewId(doc.id);
        setPreviewError(null);

        let signedUrl: string | null = null;
        if (onPreviewUrl) {
          signedUrl = await onPreviewUrl(doc.storagePath);
        }

        if (!signedUrl) {
          setPreviewError(
            'Could not generate a preview link. Please try again in a moment.'
          );
          return;
        }

        // Open signed URL in a new tab (expires in 5 minutes)
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } catch {
        setPreviewError('An error occurred while loading the preview.');
      } finally {
        setLoadingPreviewId(null);
      }
    },
    [onPreviewUrl]
  );

  // Handle soft delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (!documentToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      const res = onDeleteDocument
        ? await onDeleteDocument(documentToDelete.id)
        : await deleteDocument(documentToDelete.id);

      if (res && 'ok' in res && !res.ok) {
        setDeleteError(res.message || 'Could not remove this bill.');
        return;
      }

      // Optimistically remove from local state
      setDocuments((prev) => prev.filter((d) => d.id !== documentToDelete.id));
      setDocumentToDelete(null);
      router.refresh();
    } catch {
      setDeleteError('Could not hide this bill. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [documentToDelete, onDeleteDocument, router]);

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {/* Feedback banner for preview errors */}
      {previewError && (
        <div
          role="alert"
          className="p-4 rounded-[8px] bg-surface border border-line text-sm text-ink font-medium flex items-center justify-between"
        >
          <span>{previewError}</span>
          <button
            type="button"
            onClick={() => setPreviewError(null)}
            className="min-h-[48px] px-3 text-sm text-muted hover:text-ink font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-xl bg-surface/50 border border-line">
        {/* Status filter pills */}
        <div
          role="group"
          aria-label="Filter by status"
          className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0"
        >
          {STATUS_FILTERS.map((filter) => {
            const isSelected = selectedStatus === filter.id;
            const count = filter.countKey
              ? liveStatusCounts[filter.countKey] ?? initialStatusCounts?.[filter.countKey]
              : undefined;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSelectedStatus(filter.id)}
                aria-pressed={isSelected}
                className={`min-h-[48px] px-4 py-2 rounded-[8px] text-sm font-semibold whitespace-nowrap transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'bg-ink text-background border-ink'
                    : 'bg-background text-muted hover:text-ink border-line'
                }`}
              >
                {filter.label}
                {typeof count === 'number' && (
                  <span
                    className={`ml-1.5 text-xs px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-background/20 text-background'
                        : 'bg-surface text-ink'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Month / Return Period selector */}
        <div className="flex items-center gap-2 sm:self-end lg:self-auto">
          <label htmlFor="month-filter-select" className="text-sm font-medium text-muted whitespace-nowrap">
            Month:
          </label>
          <select
            id="month-filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[48px] px-4 py-2.5 rounded-[8px] border border-line bg-background text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="all">All months</option>
            {availableMonths.map((fp) => (
              <option key={fp} value={fp}>
                {formatPeriod(fp)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Document Content */}
      {filteredDocuments.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-line bg-surface/30 space-y-3">
          <p className="text-base font-semibold text-ink">
            {documents.length === 0
              ? 'No bills yet. Use the upload panel above to send the first bill.'
              : 'No bills match the selected filters.'}
          </p>
          {(selectedStatus !== 'all' || selectedMonth !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedStatus('all');
                setSelectedMonth('all');
              }}
              className="inline-flex items-center justify-center min-h-[48px] px-4 py-2.5 text-sm font-medium rounded-[8px] border border-line bg-background text-ink hover:bg-surface transition-colors"
            >
              Show all bills
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on mobile, visible on md+) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-line bg-background">
            <table className="hidden md:table w-full text-left text-sm text-ink">
              <thead className="bg-surface border-b border-line text-xs uppercase tracking-wider text-muted font-semibold">
                <tr>
                  <th scope="col" className="px-4 py-3.5">
                    Bill Name
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Return Period
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Size
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Uploaded At
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredDocuments.map((doc) => {
                  const badgeStyle = getStatusBadgeStyle(doc.status, 'accountant');
                  const isLoadingPreview = loadingPreviewId === doc.id;

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-surface/50 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5 font-medium text-ink max-w-[240px]">
                        <span className="truncate block" title={doc.originalName}>
                          {doc.originalName}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-ink">
                        {formatPeriod(doc.periodFp)}
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted font-mono text-xs">
                        {formatFileSize(doc.sizeBytes)}
                      </td>

                      {/* Status Badge with Words + Distinct Border Style */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          style={{ borderStyle: badgeStyle.borderStyle }}
                          className="inline-flex items-center px-3 py-1 rounded-[6px] text-xs font-semibold border-2 border-line bg-surface text-ink"
                          title={badgeStyle.description}
                          aria-label={badgeStyle.description}
                        >
                          {badgeStyle.text}
                        </span>
                      </td>

                      {/* Uploaded At */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted text-xs">
                        {formatDateTime(doc.createdAt)}
                      </td>

                      {/* Actions: Preview/Download & Delete */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreview(doc)}
                            disabled={isLoadingPreview}
                            aria-label={`Preview and download ${doc.originalName}`}
                            className="inline-flex items-center justify-center min-h-[48px] px-3.5 py-2 text-sm font-semibold text-ink rounded-[8px] hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {isLoadingPreview ? 'Loading...' : 'Preview'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDocumentToDelete(doc)}
                            aria-label={`Hide bill ${doc.originalName}`}
                            className="inline-flex items-center justify-center min-h-[48px] px-3.5 py-2 text-sm font-semibold text-muted hover:text-ink rounded-[8px] hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            Hide
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View (visible on mobile, hidden on md+) */}
          <div className="block md:hidden space-y-4">
            {filteredDocuments.map((doc) => {
              const badgeStyle = getStatusBadgeStyle(doc.status, 'accountant');
              const isLoadingPreview = loadingPreviewId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="p-5 rounded-xl border border-line bg-surface space-y-4"
                >
                  {/* Card Header: Title & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <h4
                      className="text-base font-bold text-ink break-words flex-1"
                      title={doc.originalName}
                    >
                      {doc.originalName}
                    </h4>
                    <span
                      style={{ borderStyle: badgeStyle.borderStyle }}
                      className="inline-flex items-center px-3 py-1 rounded-[6px] text-xs font-semibold border-2 border-line bg-background text-ink whitespace-nowrap"
                      title={badgeStyle.description}
                      aria-label={badgeStyle.description}
                    >
                      {badgeStyle.text}
                    </span>
                  </div>

                  {/* Metadata List */}
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted uppercase tracking-wider">Period</dt>
                      <dd className="mt-0.5 font-medium text-ink">
                        {formatPeriod(doc.periodFp)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted uppercase tracking-wider">Size</dt>
                      <dd className="mt-0.5 font-mono text-ink">
                        {formatFileSize(doc.sizeBytes)}
                      </dd>
                    </div>

                    <div className="col-span-2">
                      <dt className="text-muted uppercase tracking-wider">Uploaded</dt>
                      <dd className="mt-0.5 text-muted">
                        {formatDateTime(doc.createdAt)}
                      </dd>
                    </div>
                  </dl>

                  {/* Actions (48px tap targets) */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={() => handlePreview(doc)}
                      disabled={isLoadingPreview}
                      aria-label={`Preview and download ${doc.originalName}`}
                      className="inline-flex items-center justify-center min-h-[48px] px-4 py-2.5 rounded-[8px] bg-background border border-line text-sm font-semibold text-ink hover:bg-surface transition-colors"
                    >
                      {isLoadingPreview ? 'Loading...' : 'Preview'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDocumentToDelete(doc)}
                      aria-label={`Hide bill ${doc.originalName}`}
                      className="inline-flex items-center justify-center min-h-[48px] px-4 py-2.5 rounded-[8px] bg-background border border-line text-sm font-semibold text-muted hover:text-ink transition-colors"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Plain Soft-Delete Confirmation Modal */}
      {documentToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl bg-surface border border-line shadow-lg space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 id="delete-modal-title" className="text-xl font-bold text-ink">
                Hide this bill?
              </h3>
              <p id="delete-modal-description" className="text-sm text-muted">
                {DELETE_CONFIRMATION_MESSAGE}
              </p>
              <p className="text-xs font-mono text-ink bg-background border border-line p-2.5 rounded-[8px] break-all">
                {documentToDelete.originalName}
              </p>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="p-3 rounded-[8px] bg-background border border-line text-sm text-ink font-medium"
              >
                {deleteError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDocumentToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="min-h-[48px] px-5 py-2.5 rounded-[8px] border border-line bg-background text-sm font-semibold text-ink hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[48px] px-5 py-2.5 rounded-[8px] bg-ink text-background text-sm font-semibold hover:bg-ink/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isDeleting ? 'Hiding bill...' : 'Hide bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentList;
