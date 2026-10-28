'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface PortalBillsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PortalBillsError({ error, reset }: PortalBillsErrorProps) {
  useEffect(() => {
    // Log error internally for diagnostic monitoring without showing technical details to shop owners
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="rounded-xl border border-line bg-surface p-6 sm:p-10 text-center max-w-lg mx-auto"
    >
      <div className="space-y-4">
        {/* Warning / Notice Indicator Icon */}
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
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 7.5h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Could not load your bills
          </h1>
          <p className="text-base text-muted">
            We had trouble loading your bills. Please check your internet connection and try again.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/portal"
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-lg border border-line bg-background px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Back to portal
          </Link>
        </div>
      </div>
    </div>
  );
}
