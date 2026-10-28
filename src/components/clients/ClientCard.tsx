import React from 'react';
import Link from 'next/link';
import type { ClientListItem, OwnerAccessState } from '@/lib/clients/types';
import type { Scheme } from '@/lib/domain/tenancy';
import { StatusBadge } from './StatusBadge';

export interface ClientCardProps {
  client: ClientListItem;
  className?: string;
}

function formatScheme(scheme: Scheme): string {
  switch (scheme) {
    case 'regular':
      return 'Regular';
    case 'qrmp':
      return 'QRMP';
    case 'composition':
      return 'Composition';
    case 'unregistered':
      return 'Unregistered';
    default:
      return scheme;
  }
}

function formatOwnerAccess(state: OwnerAccessState): string {
  switch (state) {
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invite sent';
    case 'none':
    default:
      return 'No invite';
  }
}

export function ClientCard({ client, className = '' }: ClientCardProps) {
  const hasTradeName =
    client.names.trade_name &&
    client.names.trade_name.trim().toLowerCase() !==
      client.names.legal_name.trim().toLowerCase();

  return (
    <article
      aria-label={client.names.legal_name}
      className={`rounded-xl border border-line bg-surface p-4 space-y-3 ${className}`.trim()}
    >
      {/* Header: Business names & Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 flex-1 min-w-0">
          <h3 className="text-base font-bold text-ink leading-snug break-words">
            {client.names.legal_name}
          </h3>
          {hasTradeName ? (
            <p className="text-xs text-muted truncate">
              Trade: {client.names.trade_name}
            </p>
          ) : null}
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={client.status_label} />
        </div>
      </div>

      {/* Details: GSTIN, State, Scheme, Owner Access */}
      <div className="space-y-1.5 pt-1 text-sm text-ink">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-medium text-muted">GSTIN:</span>
          <span className="font-mono text-xs font-semibold tracking-wider text-ink">
            {client.gstin}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-medium text-muted">State:</span>
          <span className="text-xs font-medium text-ink">{client.state_name}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-medium text-muted">Scheme:</span>
          <span className="text-xs font-medium text-ink">
            {formatScheme(client.scheme)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-medium text-muted">Owner Access:</span>
          <span className="text-xs font-medium text-ink">
            {formatOwnerAccess(client.owner_access_state)}
          </span>
        </div>
      </div>

      {/* Action links with minimum 48px tap targets */}
      <div className="flex items-center gap-2 pt-2 border-t border-line">
        <Link
          href={`/app/clients/${client.id}`}
          aria-label={`View ${client.names.legal_name}`}
          className="flex-1 min-h-[48px] inline-flex items-center justify-center rounded-lg bg-background border border-line text-accent hover:text-accent-hover text-sm font-semibold px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          View
        </Link>
        <Link
          href={`/app/clients/${client.id}/edit`}
          aria-label={`Edit ${client.names.legal_name}`}
          className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-lg bg-background border border-line text-ink hover:text-accent text-sm font-medium px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}

export default ClientCard;
