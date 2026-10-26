import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireUser } from './require-user';
import type { SessionContext, AuthClient } from './types';

interface ClientRecordRow {
  id: string;
  legal_name?: string;
  trade_name?: string | null;
  name?: string;
  deleted_at?: string | null;
}

/**
 * Ensures the authenticated user belongs to a firm with at least the required role.
 * Role hierarchy: 'admin' > 'staff'.
 * - If user has no firm -> redirects to `session.home`.
 * - If requiredRole is 'admin' and user is 'staff' -> redirects to `session.home`.
 *
 * @param requiredRole - Minimum firm role required ('staff' by default, or 'admin')
 * @returns SessionContext guaranteed to contain a non-null firm
 */
export async function requireFirmRole(
  requiredRole: 'admin' | 'staff' = 'staff'
): Promise<SessionContext & { firm: NonNullable<SessionContext['firm']> }> {
  const session = await requireUser();

  if (!session.firm) {
    redirect(session.home);
  }

  if (requiredRole === 'admin' && session.firm.role !== 'admin') {
    redirect(session.home);
  }

  return session as SessionContext & { firm: NonNullable<SessionContext['firm']> };
}

/**
 * Ensures the authenticated user has access to a specific client (or has general client access).
 * Access is granted if:
 * 1. User has direct client_access for clientId, OR
 * 2. User belongs to the firm that owns clientId.
 *
 * If clientId is omitted:
 * - If user has no access (home === '/no-access'), redirects to `session.home`.
 * - Otherwise returns session with first client as currentClient (if any).
 *
 * If clientId is specified and user lacks access, redirects to `session.home`.
 *
 * @param clientId - Optional ID of the client to access
 * @returns SessionContext with optional currentClient
 */
export async function requireClientAccess(
  clientId?: string
): Promise<SessionContext & { currentClient?: AuthClient }> {
  const session = await requireUser();

  if (!clientId) {
    if (session.home === '/no-access') {
      redirect(session.home);
    }

    return {
      ...session,
      currentClient: session.clients[0],
    };
  }

  // 1. Check direct client_access in session
  let currentClient: AuthClient | undefined = session.clients.find(
    (c) => c.id === clientId
  );

  // 2. If not in direct client_access, check if user belongs to the owning firm
  if (!currentClient && session.firm) {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('clients')
      .select('id, legal_name, trade_name, deleted_at')
      .eq('id', clientId)
      .eq('firm_id', session.firm.id)
      .is('deleted_at', null)
      .maybeSingle();

    const client = data as unknown as ClientRecordRow | null;

    if (!error && client && !client.deleted_at) {
      currentClient = {
        id: client.id,
        name:
          client.trade_name ||
          client.legal_name ||
          client.name ||
          '',
        role: session.firm.role === 'admin' ? 'owner' : 'staff',
      };
    }
  }

  // 3. If still no access, redirect to home route
  if (!currentClient) {
    redirect(session.home);
  }

  return {
    ...session,
    currentClient,
  };
}
