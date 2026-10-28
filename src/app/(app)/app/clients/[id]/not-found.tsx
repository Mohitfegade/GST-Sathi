import Link from 'next/link';

export default function ClientNotFound() {
  return (
    <div
      role="region"
      aria-label="Client not found"
      className="rounded-xl border border-line bg-surface p-8 text-center sm:p-12"
    >
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          404 error
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Client not found
        </h1>
        <p className="text-base text-muted sm:text-lg">
          We could not find this client. They may have been removed or you may not have access to this firm.
        </p>
        <div className="pt-4 flex justify-center">
          <Link
            href="/app/clients"
            className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Back to all clients
          </Link>
        </div>
      </div>
    </div>
  );
}
