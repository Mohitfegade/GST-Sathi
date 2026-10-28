import React from 'react';
import Link from 'next/link';
import { requireClientAccess } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { getDocumentStatusCounts, listDocuments } from '@/lib/uploads/queries';
import { getStatusBadgeStyle } from '@/lib/uploads/status-labels';

interface PortalPageProps {
  searchParams?: Promise<{ client?: string }>;
}

/**
 * Formats ISO date string into readable plain-English format (e.g. 28 Oct 2026).
 */
function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const session = await requireClientAccess();
  const params = searchParams ? await searchParams : {};
  const requestedClientId =
    typeof params?.client === 'string' ? params.client : undefined;

  const hasMultipleClients = session.clients.length > 1;

  // Determine active client (requested via query param, or first client)
  const activeClient =
    (requestedClientId
      ? session.clients.find((c) => c.id === requestedClientId)
      : undefined) || session.clients[0];

  // Fetch client details (such as GSTIN and legal/trade names) from database
  const clientIds = session.clients.map((c) => c.id);
  const clientDetailsMap: Record<
    string,
    { id: string; name: string; gstin: string }
  > = {};

  if (clientIds.length > 0) {
    try {
      const supabase = await createServerClient<Database>();
      const { data: dbClients } = await supabase
        .from('clients')
        .select('id, legal_name, trade_name, gstin')
        .in('id', clientIds)
        .is('deleted_at', null);

      if (dbClients) {
        for (const item of dbClients as Array<{
          id: string;
          legal_name?: string | null;
          trade_name?: string | null;
          gstin?: string | null;
        }>) {
          clientDetailsMap[item.id] = {
            id: item.id,
            name: item.trade_name || item.legal_name || 'Business',
            gstin: item.gstin || '',
          };
        }
      }
    } catch (error) {
      console.error('Error loading client details:', error);
    }

    // Fallback for any client missing from DB query result
    for (const c of session.clients) {
      if (!clientDetailsMap[c.id]) {
        clientDetailsMap[c.id] = {
          id: c.id,
          name: c.name || 'Business',
          gstin: '',
        };
      }
    }
  }

  const activeDetails = activeClient
    ? clientDetailsMap[activeClient.id]
    : undefined;

  // Fetch quick summary counts and recent bills for active business
  let billCounts = {
    total: 0,
    uploaded: 0,
    queued: 0,
    processing: 0,
    needsReview: 0,
    done: 0,
    failed: 0,
  };
  let recentBills: Awaited<ReturnType<typeof listDocuments>>['items'] = [];

  if (activeClient?.id) {
    try {
      const [counts, paginated] = await Promise.all([
        getDocumentStatusCounts(activeClient.id),
        listDocuments(activeClient.id, { pageSize: 3 }),
      ]);
      billCounts = counts;
      recentBills = paginated.items;
    } catch (error) {
      console.error('Error loading bill summary:', error);
    }
  }

  const billsUrl = activeClient
    ? `/portal/bills?client=${encodeURIComponent(activeClient.id)}`
    : '/portal/bills';

  const inProgressCount =
    billCounts.uploaded + billCounts.queued + billCounts.processing;
  const needsAttentionCount = billCounts.needsReview + billCounts.failed;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title & Introduction */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink">
          Shop Owner Portal
        </h1>
        <p className="text-base sm:text-lg text-muted">
          Welcome to your portal. View your business details and send bills to your accountant.
        </p>
      </div>

      {/* Multiple Clients Handling: Choose your business selector */}
      {hasMultipleClients && (
        <section aria-labelledby="choose-business-heading" className="space-y-4">
          <div>
            <h2
              id="choose-business-heading"
              className="text-xl sm:text-2xl font-bold text-ink"
            >
              Choose your business
            </h2>
            <p className="text-sm sm:text-base text-muted mt-1">
              Select which business you want to view.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {session.clients.map((c) => {
              const details = clientDetailsMap[c.id];
              const isSelected = activeClient?.id === c.id;
              const displayName = details?.name || c.name;
              const gstin = details?.gstin;

              return (
                <Link
                  key={c.id}
                  href={`/portal?client=${encodeURIComponent(c.id)}`}
                  className={`flex flex-col justify-between p-5 rounded-xl border transition-colors min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? 'border-accent bg-surface ring-1 ring-accent'
                      : 'border-line bg-background hover:bg-surface'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg font-bold text-ink">
                        {displayName}
                      </span>
                      {isSelected ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-accent text-on-accent shrink-0">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-muted bg-surface border border-line shrink-0">
                          Select
                        </span>
                      )}
                    </div>
                    {gstin ? (
                      <p className="font-mono text-sm text-muted">
                        GSTIN: <span className="text-ink">{gstin}</span>
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 1 Client Handling: Display business name and GSTIN clearly */}
      {!hasMultipleClients && activeDetails && (
        <section aria-labelledby="single-business-heading">
          <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 space-y-4">
            <div>
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted">
                Your Business
              </span>
              <h2
                id="single-business-heading"
                className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink mt-1"
              >
                {activeDetails.name}
              </h2>
            </div>

            <div className="pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-sm sm:text-base font-medium text-muted">
                GST Identification Number (GSTIN)
              </span>
              <span className="font-mono text-base sm:text-lg font-semibold text-ink bg-background px-3 py-1.5 rounded-lg border border-line inline-block self-start sm:self-auto">
                {activeDetails.gstin || 'Not available'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Selected Business Overview for multiple businesses */}
      {hasMultipleClients && activeDetails && (
        <div className="bg-surface border border-line rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Current Business
            </span>
            <p className="text-lg font-bold text-ink mt-0.5">
              {activeDetails.name}
            </p>
          </div>
          {activeDetails.gstin ? (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted">GSTIN:</span>
              <span className="font-mono text-sm sm:text-base font-semibold text-ink bg-background px-3 py-1 rounded border border-line">
                {activeDetails.gstin}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Primary Call-to-Action Card: Add Bills */}
      <section aria-labelledby="add-bills-cta-heading">
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-lg bg-background border border-line flex items-center justify-center text-accent shrink-0"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </div>
              <h2
                id="add-bills-cta-heading"
                className="text-xl sm:text-2xl font-bold text-ink"
              >
                Add bills
              </h2>
            </div>
            <p className="text-base text-muted leading-relaxed">
              Take photos of purchase bills with your phone camera or upload PDF receipts. Your accountant will verify them for your GST return.
            </p>
          </div>

          <div className="w-full md:w-auto shrink-0">
            <Link
              href={billsUrl}
              className="inline-flex items-center justify-center w-full md:w-auto min-h-[48px] px-6 py-3 rounded-lg text-base font-semibold text-on-accent bg-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            >
              Add bills
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Summary of Bills Sent */}
      <section aria-labelledby="bills-summary-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2
              id="bills-summary-heading"
              className="text-xl sm:text-2xl font-bold text-ink"
            >
              Bills summary
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Status of bills sent for {activeDetails?.name || 'this business'}.
            </p>
          </div>
          <Link
            href={billsUrl}
            className="inline-flex items-center min-h-[48px] text-sm font-semibold text-accent hover:text-accent-hover self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg px-2"
          >
            Go to Bills page →
          </Link>
        </div>

        {billCounts.total === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-6 text-center space-y-2">
            <p className="text-base font-semibold text-ink">
              No bills sent yet
            </p>
            <p className="text-sm text-muted">
              You haven&apos;t sent any bills for this business yet. Tap Add bills to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-line bg-surface space-y-1">
              <span className="text-xs uppercase font-semibold tracking-wider text-muted">
                Total sent
              </span>
              <p className="text-2xl font-bold text-ink">{billCounts.total}</p>
              <span className="text-xs text-muted block">All purchase bills</span>
            </div>

            <div className="p-4 rounded-xl border-2 border-solid border-line bg-surface space-y-1">
              <span className="text-xs uppercase font-semibold tracking-wider text-muted">
                Checked
              </span>
              <p className="text-2xl font-bold text-ink">{billCounts.done}</p>
              <span className="text-xs text-muted block">Verified by accountant</span>
            </div>

            <div className="p-4 rounded-xl border-2 border-double border-line bg-surface space-y-1">
              <span className="text-xs uppercase font-semibold tracking-wider text-muted">
                Being read
              </span>
              <p className="text-2xl font-bold text-ink">{inProgressCount}</p>
              <span className="text-xs text-muted block">In progress</span>
            </div>

            <div className="p-4 rounded-xl border-2 border-groove border-line bg-surface space-y-1">
              <span className="text-xs uppercase font-semibold tracking-wider text-muted">
                Needs a look
              </span>
              <p className="text-2xl font-bold text-ink">{needsAttentionCount}</p>
              <span className="text-xs text-muted block">
                {needsAttentionCount > 0 ? 'Requires attention' : 'None pending'}
              </span>
            </div>
          </div>
        )}

        {/* Recent bills quick snippet */}
        {recentBills.length > 0 && (
          <div className="pt-2">
            <h3 className="text-base font-semibold text-ink mb-3">
              Recently sent bills
            </h3>
            <div className="space-y-2.5">
              {recentBills.map((bill) => {
                const badge = getStatusBadgeStyle(bill.status, 'owner');
                return (
                  <div
                    key={bill.id}
                    className="p-4 rounded-lg border border-line bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-ink truncate">
                        {bill.originalName}
                      </p>
                      <p className="text-xs text-muted">
                        Sent on {formatDate(bill.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded text-xs font-semibold bg-surface text-ink border-2"
                        style={{ borderStyle: badge.borderStyle }}
                        title={badge.description}
                      >
                        {badge.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
