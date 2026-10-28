import React from 'react';
import type { ClientStatusLabel } from '@/lib/clients/types';

export interface StatusBadgeProps {
  status: ClientStatusLabel;
  className?: string;
}

/**
 * Returns distinct border styling per status.
 * Communicates status through explicit text and border style, NEVER color alone.
 * Uses design tokens exclusively.
 */
function getStatusBorderStyle(status: ClientStatusLabel): string {
  switch (status) {
    case 'No activity yet':
      // Dashed subtle line for zero activity
      return 'border border-dashed border-line';
    case 'Documents waiting':
      // Dotted line for pending documents
      return 'border-2 border-dotted border-line';
    case 'Needs attention':
      // Double ink border for high emphasis warning
      return 'border-2 border-double border-ink';
    case 'Ready for review':
      // Thick solid line for completed reconciliation
      return 'border-2 border-solid border-line';
    case 'Filed':
      // Solid ink line for completed filing
      return 'border border-solid border-ink';
    default:
      return 'border border-solid border-line';
  }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const borderStyle = getStatusBorderStyle(status);

  return (
    <span
      data-status={status}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface text-ink whitespace-nowrap ${borderStyle} ${className}`.trim()}
    >
      {status}
    </span>
  );
}

export default StatusBadge;
