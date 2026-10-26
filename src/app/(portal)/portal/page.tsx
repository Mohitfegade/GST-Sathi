import React from 'react';
import Link from 'next/link';
import { requireClientAccess } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

interface PortalPageProps {
  searchParams?: Promise<{ client?: string }>;
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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title & Introduction */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink">
          Shop Owner Portal
        </h1>
        <p className="text-base sm:text-lg text-muted">
          Welcome to your portal. View your business details and manage your tax
          records.
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

      {/* Empty State Card: Bill upload is coming soon */}
      <section aria-labelledby="bill-upload-card-heading">
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 lg:p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-background border border-line flex items-center justify-center text-muted">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.75"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>

          <div className="space-y-2 max-w-lg">
            <h3
              id="bill-upload-card-heading"
              className="text-xl sm:text-2xl font-bold text-ink"
            >
              Bill upload is coming soon
            </h3>
            <p className="text-base sm:text-lg text-muted leading-relaxed">
              Your accountant will prepare your GST return from the bills you share. A simple upload button for photos and PDF bills will be here soon.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg text-base font-medium text-on-accent bg-accent opacity-50 cursor-not-allowed"
            >
              Upload bills (Coming Soon)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
