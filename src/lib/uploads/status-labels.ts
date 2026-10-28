/**
 * Status labels and visual badge styling for purchase-bill and document uploads.
 * Provides distinct plain-English wording for Accountant and Owner (Client) views,
 * as well as distinct border styles to ensure accessibility without relying on color alone (WCAG 1.4.1).
 */

import type { DocStatus } from './types';

/**
 * Accountant status labels: technical, action-oriented wording for accounting staff.
 */
export const ACCOUNTANT_STATUS_LABELS: Record<DocStatus, string> = {
  uploaded: 'Uploaded',
  queued: 'Queued',
  processing: 'Reading',
  needs_review: 'Needs review',
  done: 'Done',
  failed: 'Failed',
};

/**
 * Owner status labels: simple, friendly plain-English for small business owners / clients.
 */
export const OWNER_STATUS_LABELS: Record<DocStatus, string> = {
  uploaded: 'Received',
  queued: 'Received',
  processing: 'Being read',
  needs_review: 'Needs a look',
  done: 'Checked',
  failed: 'Could not read, please take the photo again',
};

/**
 * Returns plain-English status label for Accountant context.
 */
export function getAccountantStatusLabel(status: DocStatus): string {
  return ACCOUNTANT_STATUS_LABELS[status] ?? status;
}

/**
 * Returns plain-English status label for Owner / Client context.
 */
export function getOwnerStatusLabel(status: DocStatus): string {
  return OWNER_STATUS_LABELS[status] ?? status;
}

/**
 * Returns the status label according to the viewer's role context.
 */
export function getStatusLabel(
  status: DocStatus,
  role: 'accountant' | 'owner' | 'client' = 'accountant'
): string {
  return role === 'owner' || role === 'client'
    ? getOwnerStatusLabel(status)
    : getAccountantStatusLabel(status);
}

export interface StatusBadgeStyle {
  borderStyle: string;
  text: string;
  description: string;
}

/**
 * Distinct border styles mapped to each status so color-blind users can distinguish states.
 * - uploaded: dotted
 * - queued: dashed
 * - processing: double
 * - needs_review: groove
 * - done: solid
 * - failed: ridge
 */
export const STATUS_BORDER_STYLES: Record<DocStatus, string> = {
  uploaded: 'dotted',
  queued: 'dashed',
  processing: 'double',
  needs_review: 'groove',
  done: 'solid',
  failed: 'ridge',
};

export const STATUS_BADGE_STYLES: Record<DocStatus, StatusBadgeStyle> = {
  uploaded: {
    borderStyle: 'dotted',
    text: 'Uploaded',
    description: 'Uploaded - awaiting queue (dotted border)',
  },
  queued: {
    borderStyle: 'dashed',
    text: 'Queued',
    description: 'Queued - in line to be read (dashed border)',
  },
  processing: {
    borderStyle: 'double',
    text: 'Reading',
    description: 'Reading - currently extracting data (double border)',
  },
  needs_review: {
    borderStyle: 'groove',
    text: 'Needs review',
    description: 'Needs review - manual check required (groove border)',
  },
  done: {
    borderStyle: 'solid',
    text: 'Done',
    description: 'Done - checked and verified (solid border)',
  },
  failed: {
    borderStyle: 'ridge',
    text: 'Failed',
    description: 'Failed - could not read (ridge border)',
  },
};

/**
 * Provides distinct border styles (dashed, dotted, double, solid, groove, ridge)
 * along with display text and screen-reader accessible descriptions
 * to avoid reliance on color alone.
 */
export function getStatusBadgeStyle(
  status: DocStatus,
  context: 'accountant' | 'owner' | 'client' = 'accountant'
): StatusBadgeStyle {
  const borderStyle = STATUS_BORDER_STYLES[status] ?? 'solid';
  const label =
    context === 'owner' || context === 'client'
      ? getOwnerStatusLabel(status)
      : getAccountantStatusLabel(status);

  const base = STATUS_BADGE_STYLES[status];
  const description =
    context === 'owner' || context === 'client'
      ? `${label} (${borderStyle} border)`
      : (base?.description ?? `${label} (${borderStyle} border)`);

  return {
    borderStyle,
    text: label,
    description,
  };
}
