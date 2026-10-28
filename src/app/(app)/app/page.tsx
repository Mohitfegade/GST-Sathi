import type { Metadata } from 'next';
import Link from 'next/link';
import { requireFirmRole } from '@/lib/auth/roles';
import { getClientCounts } from '@/lib/clients/queries';

export const instant = false;

export const metadata: Metadata = {
  title: 'Workspace | GST Saathi',
  description: 'Manage clients and GST compliance for small businesses.',
};

export default async function AccountantAppPage() {
  await requireFirmRole('staff');
  const counts = await getClientCounts().catch(() => ({ total: 0, active: 0, archived: 0 }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Accountant Workspace
        </h1>
        <p className="mt-1 text-base sm:text-lg text-muted">
          Manage clients and prepare GST returns for small businesses.
        </p>
      </div>

      {/* Summary card */}
      <section
        aria-label="Client summary"
        className="rounded-xl border border-line bg-surface/30 p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Active clients
            </span>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-ink mt-1">
              {counts.active}
            </p>
            <p className="text-sm text-muted mt-1">
              {counts.active === 1
                ? '1 business under management'
                : `${counts.active} businesses under management`}
              {counts.archived > 0 && ` (${counts.archived} hidden)`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/app/clients/new"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-on-accent hover:bg-accent-hover transition-colors min-h-[48px]"
            >
              Add client
            </Link>
            <Link
              href="/app/clients"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 text-sm font-medium text-ink hover:bg-surface/80 transition-colors min-h-[48px]"
            >
              View all clients
            </Link>
          </div>
        </div>

        {counts.active === 0 && (
          <div className="pt-4 border-t border-line text-sm text-muted">
            <p>
              Get started by adding your first client business. Once added, you can send an invite link to the shop owner to share their purchase bills.
            </p>
          </div>
        )}
      </section>

      {/* Quick links & workflow explanation */}
      <section
        aria-label="How client management works"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="rounded-xl border border-line bg-surface/30 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Step 1
          </span>
          <h3 className="text-base font-semibold text-ink">Add client business</h3>
          <p className="text-sm text-muted">
            Enter the business name, 15-character GSTIN, and tax scheme. State is automatically detected.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface/30 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Step 2
          </span>
          <h3 className="text-base font-semibold text-ink">Invite shop owner</h3>
          <p className="text-sm text-muted">
            Copy a private invite link or share directly via WhatsApp to give the shop owner portal access.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface/30 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Step 3
          </span>
          <h3 className="text-base font-semibold text-ink">Reconcile & file</h3>
          <p className="text-sm text-muted">
            Collect bills, match with government GSTR-2B, and review drafted returns before filing.
          </p>
        </div>
      </section>
    </div>
  );
}
