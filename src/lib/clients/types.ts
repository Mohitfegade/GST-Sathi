import type { Scheme, AatoBand, Lang } from '@/lib/domain/tenancy';

// ============================================================================
// 1. Status Labels for Clients List
// ============================================================================

export const CLIENT_STATUS_LABELS = [
  'No activity yet',
  'Documents waiting',
  'Needs attention',
  'Ready for review',
  'Filed',
] as const;

export type ClientStatusLabel = (typeof CLIENT_STATUS_LABELS)[number];

// ============================================================================
// 2. Client Form Input Fields
// ============================================================================

export interface ClientForm {
  legal_name: string;
  trade_name?: string;
  gstin: string;
  scheme: Scheme;
  aato_band: AatoBand;
  sells_exempt: boolean;
  sells_taxable: boolean;
  language: Lang;
}

// ============================================================================
// 3. Client List Item & Owner Access State
// ============================================================================

export type OwnerAccessState = 'none' | 'invited' | 'active';

export interface ClientNames {
  legal_name: string;
  trade_name: string | null;
}

export interface ClientListItem {
  id: string;
  names: ClientNames;
  gstin: string;
  state_name: string;
  scheme: Scheme;
  status_label: ClientStatusLabel;
  owner_access_state: OwnerAccessState;
  deleted_at?: string | null;
  created_at?: string;
}

// ============================================================================
// 4. List Filters & Pagination
// ============================================================================

export interface ListFilters {
  search?: string;
  scheme?: Scheme | 'all';
  status?: ClientStatusLabel | 'all';
  page?: number;
}

export interface PaginatedClients {
  items: ClientListItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}
