'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { archiveClient, restoreClient } from '@/lib/clients/actions';

export interface EditClientActionsProps {
  clientId: string;
  clientName: string;
  isArchived: boolean;
  isFirmAdmin: boolean;
}

export function EditClientActions({
  clientId,
  clientName,
  isArchived,
  isFirmAdmin,
}: EditClientActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        setShowConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirm, isPending]);

  if (!isFirmAdmin) {
    return (
      <div className="text-sm text-muted">
        <p>Only firm administrators can hide or restore clients.</p>
      </div>
    );
  }

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await archiveClient(clientId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setShowConfirm(false);
        router.push('/app/clients');
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to hide client.');
      }
    });
  }

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await restoreClient(clientId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        router.push(`/app/clients/${clientId}`);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to restore client.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-line bg-surface p-3 text-sm font-medium text-ink"
        >
          {error}
        </div>
      )}

      {isArchived ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Restore this client to make them visible in your active client list again.
          </p>
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface/80 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {isPending ? 'Restoring...' : 'Restore client'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Hiding a client keeps all their uploaded documents and return history safe, but removes them from the everyday list.
          </p>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink transition-colors disabled:opacity-50 min-h-[48px]"
          >
            Hide this client
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-background p-6 shadow-xl space-y-4">
            <h3 id="confirm-archive-title" className="text-lg font-bold text-ink">
              Hide this client? Their data is kept.
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Are you sure you want to hide <strong className="text-ink">{clientName}</strong>? All their past invoices, GSTR-2B data, and returns will remain stored. You can restore this client at any time.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleArchive}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[48px]"
              >
                {isPending ? 'Hiding client...' : 'Yes, hide client'}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface/80 transition-colors min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditClientActions;
