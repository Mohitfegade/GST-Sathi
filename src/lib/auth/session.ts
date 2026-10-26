import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { SessionContext, AuthFirm, AuthClient, HomeRoute } from './types';

interface FirmMemberRow {
  role: string;
  firm_id: string;
  deleted_at?: string | null;
  firms?:
    | {
        id?: string;
        name?: string;
        deleted_at?: string | null;
      }
    | Array<{
        id?: string;
        name?: string;
        deleted_at?: string | null;
      }>
    | null;
}

interface ClientAccessRow {
  role: string;
  client_id: string;
  deleted_at?: string | null;
  clients?:
    | {
        id?: string;
        legal_name?: string;
        trade_name?: string | null;
        name?: string;
        deleted_at?: string | null;
      }
    | Array<{
        id?: string;
        legal_name?: string;
        trade_name?: string | null;
        name?: string;
        deleted_at?: string | null;
      }>
    | null;
}

/**
 * Resolves the authenticated session context for the current request.
 *
 * 1. Validates the Supabase auth user via `supabase.auth.getUser()`.
 * 2. Fetches active firm membership (joined with firms) for `user.id`.
 * 3. Fetches active client access records (joined with clients) for `user.id`.
 * 4. Computes destination `home` route:
 *    - '/app' if user has a firm
 *    - '/portal' if user is a client owner (without a firm)
 *    - '/no-access' otherwise
 *
 * @param customClient - Optional Supabase client instance (useful for testing or specific scopes)
 */
export async function getSessionContext(
  customClient?: SupabaseClient
): Promise<SessionContext | null> {
  const supabase = customClient ?? (await createServerClient());

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const [firmMemberRes, clientAccessRes] = await Promise.all([
    supabase
      .from('firm_members')
      .select('role, firm_id, deleted_at, firms(id, name, deleted_at)')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('client_access')
      .select('role, client_id, deleted_at, clients(id, legal_name, trade_name, deleted_at)')
      .eq('user_id', user.id)
      .is('deleted_at', null),
  ]);

  // Extract primary firm if any
  let firm: AuthFirm | null = null;
  const firmMembers = (firmMemberRes.data as unknown as FirmMemberRow[] | null) ?? [];

  for (const member of firmMembers) {
    if (member.deleted_at) continue;

    const firmData = Array.isArray(member.firms)
      ? member.firms[0]
      : member.firms;

    if (firmData && firmData.deleted_at) {
      continue;
    }

    const id = firmData?.id ?? member.firm_id;
    const name = firmData?.name ?? '';

    if (id) {
      firm = {
        id,
        name,
        role: member.role as 'admin' | 'staff',
      };
      break; // Takes primary firm
    }
  }

  // Extract active clients
  const clients: AuthClient[] = [];
  const clientAccessList = (clientAccessRes.data as unknown as ClientAccessRow[] | null) ?? [];

  for (const item of clientAccessList) {
    if (item.deleted_at) continue;

    const clientData = Array.isArray(item.clients)
      ? item.clients[0]
      : item.clients;

    if (clientData && clientData.deleted_at) {
      continue;
    }

    const id = clientData?.id ?? item.client_id;
    const name =
      clientData?.trade_name ||
      clientData?.legal_name ||
      clientData?.name ||
      '';

    if (id) {
      clients.push({
        id,
        name,
        role: item.role as 'owner' | 'staff',
      });
    }
  }

  // Compute home route
  let home: HomeRoute = '/no-access';
  if (firm !== null) {
    home = '/app';
  } else if (clients.some((c) => c.role === 'owner')) {
    home = '/portal';
  }

  return {
    user,
    firm,
    clients,
    home,
  };
}
