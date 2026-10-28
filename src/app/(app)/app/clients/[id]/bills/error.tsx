'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ClientBillsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ClientBillsError({ error, reset }: ClientBillsErrorProps) {
  useEffect(() => {
    // Log error internally for diagnostic monitoring without exposing technical details to user
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="rounded-xl border border-line bg-surface p-8 text-center sm:p-12"
    >
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Error
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Unable to load bills
        </h1>
        <p className="text-base text-muted sm:text-lg">
          Something went wrong loading this client&apos;s bills.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/app/clients"
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-lg border border-line bg-background px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Back to clients
          </Link>
        </div>
      </div>
    </div>
  );
}
