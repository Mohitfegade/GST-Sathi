import React from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { requireClientAccess } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { listDocuments, createPreviewUrl } from '@/lib/uploads/queries';
import { getStatusBadgeStyle } from '@/lib/uploads/status-labels';
import { formatFp, parseFp } from '@/lib/period';
import { formatFileSize } from '@/components/uploads/FileRow';
import { UploadPanel } from '@/components/uploads/UploadPanel';
import { EmptyBillsState } from '@/components/uploads/EmptyBillsState';

interface BillsPageProps {
  searchParams?: Promise<{ client?: string; month?: string; page?: string }>;
}

/**
 * Formats ISO date string into readable plain-English format (e.g. 28 Oct 2026, 11:30 AM).
 */
function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const instant = false;

export default async function OwnerBillsPage({ searchParams }: BillsPageProps) {
  await connection();
  const params = searchParams ? await searchParams : {};
  const requestedClientId =
    typeof params?.client === 'string' ? params.client : undefined;

  // 1. Verifies owner session via requireClientAccess
  const session = await requireClientAccess(requestedClientId);

  const hasMultipleClients = session.clients.length > 1;
  const activeClient =
    (requestedClientId
      ? session.clients.find((c) => c.id === requestedClientId)
      : undefined) ||
    session.currentClient ||
    session.clients[0];

  // Fetch client details (such as GSTIN and legal/trade names) from database
  const clientIds = session.clients.map((c) => c.id);
  const clientDetailsMap: Record<
    string,
    { id: string; name: string; gstin: string }
  > = {};

  if (clientIds.length > 0) {
    const { isDemoMode } = await import('@/lib/env');
    if (isDemoMode) {
      const { RAW_DEV_CLIENTS } = await import('@/lib/auth/dev-mock');
      for (const c of session.clients) {
        const match = RAW_DEV_CLIENTS.find((r) => r.id === c.id);
        clientDetailsMap[c.id] = {
          id: c.id,
          name: match?.trade_name || match?.legal_name || c.name || 'Business',
          gstin: match?.gstin || '27FAKES1234A1ZJ',
        };
      }
    } else {
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
  }

  const activeDetails = activeClient
    ? clientDetailsMap[activeClient.id]
    : undefined;
  const businessDisplayName = activeDetails?.name || activeClient?.name || 'Your Business';

  // 2. Month selector defaults to current month in MMYYYY format (e.g. October 2026 -> "102026")
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentYearNum = now.getFullYear();
  const defaultMonthFp = formatFp(currentMonthNum, currentYearNum);

  let selectedMonth = defaultMonthFp;
  const rawMonth = params?.month;
  if (typeof rawMonth === 'string' && (rawMonth === 'all' || /^\d{6}$/.test(rawMonth))) {
    selectedMonth = rawMonth;
  }

  // Generate 12 months for dropdown & quick links
  const monthsList: Array<{ fp: string; label: string; isCurrent: boolean }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYearNum, currentMonthNum - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const fp = formatFp(m, y);
    let monthName = '';
    try {
      monthName = parseFp(fp).monthName;
    } catch {
      monthName = `${m}`;
    }
    const isCurrent = fp === defaultMonthFp;
    monthsList.push({
      fp,
      label: `${monthName} ${y}${isCurrent ? ' (Current month)' : ''}`,
      isCurrent,
    });
  }

  let selectedMonthLabel = 'All months';
  if (selectedMonth !== 'all') {
    try {
      const parsed = parseFp(selectedMonth);
      selectedMonthLabel = `${parsed.monthName} ${parsed.year}`;
    } catch {
      selectedMonthLabel = selectedMonth;
    }
  }

  // 3. Fetch recent bills for the active business & selected month
  const currentPage =
    typeof params?.page === 'string' && !isNaN(Number(params.page))
      ? Math.max(1, parseInt(params.page, 10))
      : 1;

  let billsResult: Awaited<ReturnType<typeof listDocuments>> = {
    items: [],
    total: 0,
    page: currentPage,
    pageSize: 20,
    totalPages: 0,
  };

  if (activeClient?.id) {
    try {
      billsResult = await listDocuments(activeClient.id, {
        periodFp: selectedMonth === 'all' ? undefined : selectedMonth,
        page: currentPage,
        pageSize: 20,
      });
    } catch (error) {
      console.error('Error fetching documents for bills page:', error);
    }
  }

  // Generate signed preview URLs for bills
  const previewUrls: Record<string, string | null> = {};
  if (billsResult.items.length > 0) {
    await Promise.all(
      billsResult.items.map(async (doc) => {
        try {
          const url = await createPreviewUrl(doc.storagePath);
          previewUrls[doc.id] = url;
        } catch {
          previewUrls[doc.id] = null;
        }
      })
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title & Introduction */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink">
          Bills for {businessDisplayName}
        </h1>
        <p className="text-base sm:text-lg text-muted">
          Add receipts and purchase bills here. Your accountant will review each bill and include it in your GST filing.
        </p>
      </div>

      {/* Multi-business switcher (if session.clients.length > 1) */}
      {hasMultipleClients && (
        <section aria-labelledby="business-switcher-heading" className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 id="business-switcher-heading" className="text-lg sm:text-xl font-bold text-ink">
                Switch business
              </h2>
              <p className="text-sm text-muted">
                You have multiple businesses. Select which one you are adding bills for.
              </p>
            </div>
            {activeDetails?.gstin ? (
              <span className="font-mono text-xs sm:text-sm font-semibold text-ink bg-background px-3 py-1.5 rounded-lg border border-line self-start sm:self-auto">
                GSTIN: {activeDetails.gstin}
              </span>
            ) : null}
          </div>

          {/* Accessible Form Dropdown */}
          <form method="GET" action="/portal/bills" className="space-y-2">
            <input type="hidden" name="month" value={selectedMonth} />
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <label htmlFor="business-select" className="sr-only">
                Choose business
              </label>
              <select
                id="business-select"
                name="client"
                defaultValue={activeClient.id}
                className="flex-1 min-h-[48px] px-3.5 py-2.5 rounded-lg border border-line bg-background text-ink text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {session.clients.map((c) => {
                  const d = clientDetailsMap[c.id];
                  const label = d?.name || c.name;
                  return (
                    <option key={c.id} value={c.id}>
                      {label} {d?.gstin ? `(${d.gstin})` : ''}
                    </option>
                  );
                })}
              </select>
              <button
                type="submit"
                className="min-h-[48px] px-5 py-2.5 rounded-lg border border-line bg-background hover:bg-surface text-ink text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
              >
                Switch business
              </button>
            </div>
          </form>

          {/* Quick-switch business pill links */}
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">
              Quick switch:
            </span>
            {session.clients.map((c) => {
              const d = clientDetailsMap[c.id];
              const isSelected = c.id === activeClient.id;
              const name = d?.name || c.name;
              return (
                <Link
                  key={c.id}
                  href={`/portal/bills?client=${encodeURIComponent(c.id)}&month=${encodeURIComponent(selectedMonth)}`}
                  className={`inline-flex items-center justify-center min-h-[48px] px-3.5 py-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? 'border-2 border-accent bg-background text-ink font-semibold'
                      : 'border border-line bg-background text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {name}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Month Selector: "Which month are these bills for?" */}
      <section aria-labelledby="month-selector-heading" className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 id="month-selector-heading" className="text-lg sm:text-xl font-bold text-ink">
            Which month are these bills for?
          </h2>
          <p className="text-sm text-muted mt-1">
            Choose the return month for these bills. Default is the current month ({monthsList[0]?.label.replace(' (Current month)', '')}).
          </p>
        </div>

        <form method="GET" action="/portal/bills" className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input type="hidden" name="client" value={activeClient.id} />
          <label htmlFor="month-dropdown" className="sr-only">
            Select return month
          </label>
          <select
            id="month-dropdown"
            name="month"
            defaultValue={selectedMonth}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-lg border border-line bg-background text-ink text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {monthsList.map((m) => (
              <option key={m.fp} value={m.fp}>
                {m.label}
              </option>
            ))}
            <option value="all">All months</option>
          </select>
          <button
            type="submit"
            className="min-h-[48px] px-5 py-2.5 rounded-lg border border-line bg-background hover:bg-surface text-ink text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
          >
            Change month
          </button>
        </form>

        {/* Quick Month Filter Pills */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">
            Recent months:
          </span>
          {monthsList.slice(0, 4).map((m) => {
            const isSelected = selectedMonth === m.fp;
            return (
              <Link
                key={m.fp}
                href={`/portal/bills?client=${encodeURIComponent(activeClient.id)}&month=${encodeURIComponent(m.fp)}`}
                className={`inline-flex items-center justify-center min-h-[48px] px-3.5 py-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'border-2 border-accent bg-background text-ink font-semibold'
                    : 'border border-line bg-background text-muted hover:text-ink hover:bg-surface'
                }`}
              >
                {m.label.replace(' (Current month)', '')}
              </Link>
            );
          })}
          <Link
            href={`/portal/bills?client=${encodeURIComponent(activeClient.id)}&month=all`}
            className={`inline-flex items-center justify-center min-h-[48px] px-3.5 py-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              selectedMonth === 'all'
                ? 'border-2 border-accent bg-background text-ink font-semibold'
                : 'border border-line bg-background text-muted hover:text-ink hover:bg-surface'
            }`}
          >
            All months
          </Link>
        </div>
      </section>

      {/* Large Prominent "Add bills" Upload Panel */}
      <section aria-labelledby="upload-panel-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="upload-panel-heading" className="text-xl sm:text-2xl font-bold text-ink">
              Add bills
            </h2>
            <p className="text-sm sm:text-base text-muted">
              Bills will be saved for <span className="font-semibold text-ink">{selectedMonthLabel}</span>.
            </p>
          </div>
        </div>

        <UploadPanel
          clientId={activeClient.id}
          periodFp={selectedMonth === 'all' ? defaultMonthFp : selectedMonth}
          role="owner"
        />
      </section>

      {/* Recent Bills Section */}
      <section aria-labelledby="recent-bills-heading" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="recent-bills-heading" className="text-xl sm:text-2xl font-bold text-ink">
              Recent bills
            </h2>
            <p className="text-sm text-muted">
              {selectedMonth === 'all'
                ? `Showing all bills sent for ${businessDisplayName}`
                : `Showing bills sent for ${selectedMonthLabel}`}
              {billsResult.total > 0 ? ` (${billsResult.total} total)` : ''}
            </p>
          </div>
          {billsResult.total > 0 && (
            <Link
              href={`/portal/bills?client=${encodeURIComponent(activeClient.id)}&month=${encodeURIComponent(selectedMonth)}`}
              className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 rounded-lg border border-line bg-surface hover:bg-background text-xs sm:text-sm font-semibold text-ink self-start sm:self-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            >
              Refresh list
            </Link>
          )}
        </div>

        {billsResult.items.length === 0 ? (
          <EmptyBillsState
            buttonText="Add bills above"
            className="py-12"
          />
        ) : (
          <div className="space-y-3" role="list" aria-label="Recent bills list">
            {billsResult.items.map((bill) => {
              const badge = getStatusBadgeStyle(bill.status, 'owner');
              const previewUrl = previewUrls[bill.id];

              let periodDisplay = '';
              if (bill.periodFp) {
                try {
                  const p = parseFp(bill.periodFp);
                  periodDisplay = `${p.monthName} ${p.year}`;
                } catch {
                  periodDisplay = bill.periodFp;
                }
              }

              return (
                <div
                  key={bill.id}
                  role="listitem"
                  className="p-4 sm:p-5 rounded-xl border border-line bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Bill metadata */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-start sm:items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-ink truncate max-w-sm sm:max-w-md">
                        {bill.originalName}
                      </span>
                      {periodDisplay ? (
                        <span className="text-xs font-medium text-muted bg-background px-2.5 py-0.5 rounded border border-line">
                          {periodDisplay}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs sm:text-sm text-muted">
                      <span>{formatFileSize(bill.sizeBytes)}</span>
                      <span aria-hidden="true">•</span>
                      <span>Sent {formatDateTime(bill.createdAt)}</span>
                    </div>

                    {/* Explanatory helper copy for specific statuses */}
                    {bill.status === 'failed' && (
                      <p className="text-xs text-ink font-medium mt-1">
                        We could not read the text clearly. Please take a clear photo under good light and send it again.
                      </p>
                    )}
                    {bill.status === 'needs_review' && (
                      <p className="text-xs text-muted mt-1">
                        Your accountant is reviewing details on this bill.
                      </p>
                    )}
                  </div>

                  {/* Right: Status badge with words and border style, plus preview action */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
                    <span
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-background text-ink border-2"
                      style={{ borderStyle: badge.borderStyle }}
                      title={badge.description}
                      aria-label={badge.description}
                    >
                      {badge.text}
                    </span>

                    {previewUrl ? (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-accent hover:text-accent-hover bg-background border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                      >
                        View bill
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination if multiple pages */}
        {billsResult.totalPages > 1 && (
          <nav
            aria-label="Bills pagination"
            className="flex items-center justify-between pt-4 border-t border-line"
          >
            {billsResult.page > 1 ? (
              <Link
                href={`/portal/bills?client=${encodeURIComponent(activeClient.id)}&month=${encodeURIComponent(selectedMonth)}&page=${billsResult.page - 1}`}
                className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 rounded-lg text-sm font-semibold text-ink bg-surface border border-line hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              >
                ← Previous page
              </Link>
            ) : (
              <span className="min-h-[48px] px-4 py-2 text-sm text-muted">
                First page
              </span>
            )}

            <span className="text-sm font-medium text-muted">
              Page {billsResult.page} of {billsResult.totalPages}
            </span>

            {billsResult.page < billsResult.totalPages ? (
              <Link
                href={`/portal/bills?client=${encodeURIComponent(activeClient.id)}&month=${encodeURIComponent(selectedMonth)}&page=${billsResult.page + 1}`}
                className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 rounded-lg text-sm font-semibold text-ink bg-surface border border-line hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              >
                Next page →
              </Link>
            ) : (
              <span className="min-h-[48px] px-4 py-2 text-sm text-muted">
                Last page
              </span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
