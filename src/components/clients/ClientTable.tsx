import React from 'react';
import Link from 'next/link';
import type { ClientListItem, OwnerAccessState } from '@/lib/clients/types';
import type { Scheme } from '@/lib/domain/tenancy';
import { StatusBadge } from './StatusBadge';

export interface ClientTableProps {
  clients: ClientListItem[];
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

export function ClientTable({ clients, className = '' }: ClientTableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-line bg-background shadow-sm ${className}`.trim()}
    >
      <table className="w-full border-collapse text-left text-sm text-ink">
        <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="px-6 py-4">
              Business
            </th>
            <th scope="col" className="px-6 py-4">
              GSTIN & State
            </th>
            <th scope="col" className="px-6 py-4">
              Scheme
            </th>
            <th scope="col" className="px-6 py-4">
              Status
            </th>
            <th scope="col" className="px-6 py-4">
              Owner Access
            </th>
            <th scope="col" className="px-6 py-4 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-background">
          {clients.map((client) => {
            const hasTradeName =
              client.names.trade_name &&
              client.names.trade_name.trim().toLowerCase() !==
                client.names.legal_name.trim().toLowerCase();

            return (
              <tr
                key={client.id}
                className="hover:bg-surface/60 transition-colors"
              >
                {/* Business: Legal name & trade name */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-ink text-base">
                      {client.names.legal_name}
                    </span>
                    {hasTradeName ? (
                      <span className="text-xs text-muted">
                        Trade: {client.names.trade_name}
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* GSTIN & State */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium tracking-wide text-ink">
                      {client.gstin}
                    </span>
                    <span className="text-xs text-muted">
                      {client.state_name}
                    </span>
                  </div>
                </td>

                {/* Scheme */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center text-sm font-medium text-ink">
                    {formatScheme(client.scheme)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={client.status_label} />
                </td>

                {/* Owner Access */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-ink">
                    {formatOwnerAccess(client.owner_access_state)}
                  </span>
                </td>

                {/* Actions: View and Edit links with 48px tap targets */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/app/clients/${client.id}`}
                      aria-label={`View ${client.names.legal_name}`}
                      className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-accent hover:text-accent-hover hover:underline rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      View
                    </Link>
                    <Link
                      href={`/app/clients/${client.id}/edit`}
                      aria-label={`Edit ${client.names.legal_name}`}
                      className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-ink hover:text-accent hover:underline rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ClientTable;
