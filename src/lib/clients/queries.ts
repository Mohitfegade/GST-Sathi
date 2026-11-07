import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { requireFirmRole } from '@/lib/auth/roles';
import { getSessionContext } from '@/lib/auth/session';
import type { Database, Tables } from '@/lib/database.types';
import type {
  ClientListItem,
  ListFilters,
  PaginatedClients,
  ClientStatusLabel,
  OwnerAccessState,
} from './types';
import { getStateName } from '@/lib/gst/state-codes';

export const PAGE_SIZE = 25;

type ClientRow = Tables<'clients'>;

/**
 * Derives a human-readable compliance status label for a client strictly
 * from real return periods and document records. Zero invented statuses.
 */
export function deriveClientStatus(
  returnPeriods: Array<{ status: string; deleted_at?: string | null }> = [],
  documents: Array<{ status: string; deleted_at?: string | null }> = []
): ClientStatusLabel {
  const activePeriods = returnPeriods.filter((rp) => !rp.deleted_at);
  const activeDocs = documents.filter((doc) => !doc.deleted_at);

  // If no rows exist, status is STRICTLY "No activity yet"
  if (activePeriods.length === 0 && activeDocs.length === 0) {
    return 'No activity yet';
  }

  // 1. Return filed on the GST portal for active period
  if (activePeriods.some((rp) => rp.status === 'filed')) {
    return 'Filed';
  }

  // 2. Unmatched invoices or document processing issues
  if (activeDocs.some((doc) => doc.status === 'needs_review' || doc.status === 'failed')) {
    return 'Needs attention';
  }

  // 3. Draft return ready for accountant review / approved
  if (activePeriods.some((rp) => rp.status === 'in_review' || rp.status === 'approved')) {
    return 'Ready for review';
  }

  // 4. Return period opened, awaiting bills or documents currently processing
  if (
    activePeriods.some((rp) => rp.status === 'not_started' || rp.status === 'draft') ||
    activeDocs.some((doc) => doc.status === 'uploaded' || doc.status === 'queued' || doc.status === 'processing')
  ) {
    return 'Documents waiting';
  }

  return 'No activity yet';
}

/**
 * Resolves the Supabase session client and firm ID.
 * If client or firmId are passed explicitly (e.g. in tests), uses them.
 * Otherwise resolves the authenticated session using `requireFirmRole('staff')`
 * and `createServerClient()`.
 */
async function getClientAndFirm(
  customClient?: SupabaseClient<Database>,
  customFirmId?: string
): Promise<{ supabase: SupabaseClient<Database>; firmId: string }> {
  if (customClient && customFirmId) {
    return { supabase: customClient, firmId: customFirmId };
  }

  if (customClient) {
    const session = await getSessionContext(customClient);
    if (!session?.firm) {
      throw new Error('Unauthorized: Firm context required');
    }
    return { supabase: customClient, firmId: session.firm.id };
  }

  const session = await requireFirmRole('staff');
  const supabase = await createServerClient<Database>();
  return { supabase, firmId: session.firm.id };
}

/**
 * Enriches raw client database rows with derived state_name, owner_access_state,
 * and compliance status_label according to statutory rules and real activity.
 */
async function enrichClientsWithDetails(
  clients: ClientRow[],
  supabase: SupabaseClient<Database>
): Promise<ClientListItem[]> {
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((c) => c.id);
  const nowIso = new Date().toISOString();

  // Query related tables in parallel for all client IDs on the current page
  const [ownersRes, invitesRes, periodsRes, docsRes] = await Promise.all([
    supabase
      .from('client_access')
      .select('client_id')
      .in('client_id', clientIds)
      .eq('role', 'owner')
      .is('deleted_at', null),
    supabase
      .from('client_invites')
      .select('client_id')
      .in('client_id', clientIds)
      .is('accepted_at', null)
      .is('deleted_at', null)
      .gt('expires_at', nowIso),
    supabase
      .from('return_periods')
      .select('client_id, status, deleted_at')
      .in('client_id', clientIds)
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('client_id, status, deleted_at')
      .in('client_id', clientIds)
      .is('deleted_at', null),
  ]);

  const ownersSet = new Set((ownersRes.data ?? []).map((r) => r.client_id));
  const invitesSet = new Set((invitesRes.data ?? []).map((r) => r.client_id));

  const returnPeriodsMap = new Map<string, Array<{ status: string; deleted_at?: string | null }>>();
  for (const rp of periodsRes.data ?? []) {
    const list = returnPeriodsMap.get(rp.client_id) ?? [];
    list.push(rp);
    returnPeriodsMap.set(rp.client_id, list);
  }

  const documentsMap = new Map<string, Array<{ status: string; deleted_at?: string | null }>>();
  for (const doc of docsRes.data ?? []) {
    const list = documentsMap.get(doc.client_id) ?? [];
    list.push(doc);
    documentsMap.set(doc.client_id, list);
  }

  return clients.map((client): ClientListItem => {
    const code = client.state_code || (client.gstin && client.gstin.length >= 2 ? client.gstin.slice(0, 2) : '');
    const state_name = getStateName(code) ?? code ?? '';

    let owner_access_state: OwnerAccessState = 'none';
    if (ownersSet.has(client.id)) {
      owner_access_state = 'active';
    } else if (invitesSet.has(client.id)) {
      owner_access_state = 'invited';
    }

    const clientPeriods = returnPeriodsMap.get(client.id) ?? [];
    const clientDocs = documentsMap.get(client.id) ?? [];
    const status_label = deriveClientStatus(clientPeriods, clientDocs);

    return {
      id: client.id,
      names: {
        legal_name: client.legal_name,
        trade_name: client.trade_name ?? null,
      },
      gstin: client.gstin,
      state_name,
      scheme: client.scheme,
      status_label,
      owner_access_state,
      deleted_at: client.deleted_at ?? null,
      created_at: client.created_at,
    };
  });
}

/**
 * 1. listClients
 * Queries active clients (`deleted_at is null`) for the current firm (`firm_id = session.firm.id`).
 * Supports:
 * - `search`: Case-insensitive partial match on legal_name, trade_name, or gstin.
 * - `scheme`: Specific scheme filter or 'all'.
 * - `page`: 1-based page index with 25 items per page.
 * Returns paginated items conforming to `ClientListItem`.
 */
export async function listClients(
  filters: ListFilters = {},
  client?: SupabaseClient<Database>,
  firmId?: string
): Promise<PaginatedClients> {
  const { isDemoMode } = await import('@/lib/env');
  if (isDemoMode && !client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      const { queryDevClients } = await import('@/lib/auth/dev-mock');
      return queryDevClients(filters);
    }
  }

  try {
    const { supabase, firmId: resolvedFirmId } = await getClientAndFirm(client, firmId);

    const page = Math.max(1, Number.isFinite(filters.page) ? Math.floor(filters.page!) : 1);
    const pageSize = PAGE_SIZE;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('firm_id', resolvedFirmId)
      .is('deleted_at', null);

    // Filter by scheme if specified and !== 'all'
    if (filters.scheme && filters.scheme !== 'all') {
      query = query.eq('scheme', filters.scheme);
    }

    // Search filter: case-insensitive partial match on legal_name, trade_name, or gstin
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().replace(/[,()]/g, '');
      if (term) {
        query = query.or(
          `legal_name.ilike.%${term}%,trade_name.ilike.%${term}%,gstin.ilike.%${term}%`
        );
      }
    }

    // Order by created_at desc for stable, recent-first pagination
    query = query.order('created_at', { ascending: false });

    // Page slice
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const rawClients = data ?? [];
    const enriched = await enrichClientsWithDetails(rawClients, supabase);

    // If status filter is passed, filter items
    let items = enriched;
    if (filters.status && filters.status !== 'all') {
      items = items.filter((item) => item.status_label === filters.status);
    }

    const totalCount = count ?? 0;

    const { isDemoMode } = await import('@/lib/env');
    if (totalCount === 0 && !client && isDemoMode) {
      const { queryDevClients } = await import('@/lib/auth/dev-mock');
      return queryDevClients(filters);
    }

    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

    return {
      items,
      totalCount,
      currentPage: page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    const { isDemoMode } = await import('@/lib/env');
    if (isDemoMode && !client) {
      const { queryDevClients } = await import('@/lib/auth/dev-mock');
      return queryDevClients(filters);
    }
    throw err;
  }
}

/**
 * 2. getClientById
 * Fetches a single client by ID (active or archived) for the current firm.
 * Computes state_name, status_label, and owner_access_state.
 */
export async function getClientById(
  id: string,
  client?: SupabaseClient<Database>,
  firmId?: string
): Promise<ClientListItem | null> {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return null;
  }

  const { isDemoMode } = await import('@/lib/env');
  if (isDemoMode && !client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      const { getDevClientById } = await import('@/lib/auth/dev-mock');
      return getDevClientById(id);
    }
  }

  try {
    const { supabase, firmId: resolvedFirmId } = await getClientAndFirm(client, firmId);

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('firm_id', resolvedFirmId)
      .eq('id', id.trim())
      .maybeSingle();

    if (error || !data) {
      const { isDemoMode } = await import('@/lib/env');
      if (isDemoMode && !client) {
        const { getDevClientById } = await import('@/lib/auth/dev-mock');
        return getDevClientById(id);
      }
      return null;
    }

    const [enriched] = await enrichClientsWithDetails([data], supabase);
    return enriched ?? null;
  } catch (err) {
    const { isDemoMode } = await import('@/lib/env');
    if (isDemoMode && !client) {
      const { getDevClientById } = await import('@/lib/auth/dev-mock');
      return getDevClientById(id);
    }
    return null;
  }
}

/**
 * 3. getClientCounts
 * Retrieves total, active, and archived client counts for the current firm.
 */
export async function getClientCounts(
  client?: SupabaseClient<Database>,
  firmId?: string
): Promise<{ total: number; active: number; archived: number }> {
  const { isDemoMode } = await import('@/lib/env');
  if (isDemoMode && !client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      return { total: 12, active: 12, archived: 0 };
    }
  }

  try {
    const { supabase, firmId: resolvedFirmId } = await getClientAndFirm(client, firmId);

    const [activeRes, archivedRes] = await Promise.all([
      supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', resolvedFirmId)
        .is('deleted_at', null),
      supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', resolvedFirmId)
        .not('deleted_at', 'is', null),
    ]);

    if (activeRes.error) {
      throw activeRes.error;
    }
    if (archivedRes.error) {
      throw archivedRes.error;
    }

    const active = activeRes.count ?? 0;
    const archived = archivedRes.count ?? 0;
    const total = active + archived;

    const { isDemoMode } = await import('@/lib/env');
    if (total === 0 && isDemoMode && !client) {
      return { total: 12, active: 12, archived: 0 };
    }

    return { total, active, archived };
  } catch (err) {
    const { isDemoMode } = await import('@/lib/env');
    if (isDemoMode && !client) {
      return { total: 12, active: 12, archived: 0 };
    }
    throw err;
  }
}

/**
 * 4. getArchivedClients
 * Retrieves all archived clients (`deleted_at is not null`) for the current firm.
 */
export async function getArchivedClients(
  client?: SupabaseClient<Database>,
  firmId?: string
): Promise<ClientListItem[]> {
  const { supabase, firmId: resolvedFirmId } = await getClientAndFirm(client, firmId);

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('firm_id', resolvedFirmId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return enrichClientsWithDetails(data, supabase);
}
