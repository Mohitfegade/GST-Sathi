import React from 'react';
import { Button } from '@/components/ui/Button';

export interface EmptyBillsStateProps {
  /** Optional callback triggered when user taps the Add bills button */
  onAddBills?: () => void;
  /** Optional href if Add bills is a navigation link */
  uploadHref?: string;
  /** Custom action element if the caller provides their own trigger/input */
  action?: React.ReactNode;
  /** Label for the action button, defaults to "Add bills" */
  buttonText?: string;
  /** Additional custom classes */
  className?: string;
}

export function EmptyBillsState({
  onAddBills,
  uploadHref,
  action,
  buttonText = 'Add bills',
  className = '',
}: EmptyBillsStateProps) {
  const showButton = Boolean(action || onAddBills || uploadHref);

  return (
    <div
      role="region"
      aria-label="No bills yet"
      className={`rounded-xl border border-line bg-surface p-8 text-center sm:p-12 ${className}`.trim()}
    >
      <div className="mx-auto max-w-md space-y-4">
        {/* Document / Receipt Icon */}
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-background text-muted sm:h-16 sm:w-16"
        >
          <svg
            className="h-7 w-7 sm:h-8 sm:w-8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.75"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            No bills yet
          </h3>
          <p className="text-base text-muted sm:text-lg">
            Tap Add bills to send your first one.
          </p>
        </div>

        {showButton && (
          <div className="pt-2 flex justify-center">
            {action ? (
              action
            ) : uploadHref ? (
              <Button href={uploadHref} variant="primary">
                {buttonText}
              </Button>
            ) : (
              <Button onClick={onAddBills} variant="primary">
                {buttonText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmptyBillsState;
