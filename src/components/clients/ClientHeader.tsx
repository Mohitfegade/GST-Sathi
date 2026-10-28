import React from 'react';
import Link from 'next/link';
import type { ClientListItem } from '@/lib/clients/types';
import { StatusBadge } from '@/components/clients/StatusBadge';

export interface ClientHeaderProps {
  client: ClientListItem;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  const isArchived = Boolean(client.deleted_at);

  return (
    <div className="space-y-4 border-b border-line pb-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {client.names.trade_name || client.names.legal_name}
            </h1>
            {isArchived && (
              <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
                Hidden (Archived)
              </span>
            )}
          </div>

          {client.names.trade_name && (
            <p className="text-sm text-muted">
              Legal name: <span className="text-ink">{client.names.legal_name}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/app/clients/${client.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface/80 transition-colors min-h-[48px]"
          >
            Edit business
          </Link>
        </div>
      </div>

      {/* Meta tags / attributes */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-ink pt-2">
        <div className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm bg-surface border border-line px-2.5 py-1 rounded-md">
          <span className="text-muted">GSTIN:</span>
          <span className="font-semibold">{client.gstin}</span>
        </div>

        <div className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted">
          <span>State:</span>
          <span className="font-medium text-ink">{client.state_name}</span>
        </div>

        <div className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted">
          <span>Scheme:</span>
          <span className="font-medium capitalize text-ink">{client.scheme}</span>
        </div>

        <div className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted">
          <span>Compliance:</span>
          <StatusBadge status={client.status_label} />
        </div>
      </div>
    </div>
  );
}

export default ClientHeader;
