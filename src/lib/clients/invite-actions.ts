'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireFirmRole, requireClientAccess } from '@/lib/auth/roles';
import type { ActionResult } from '@/lib/auth/types';
import type { Database } from '@/lib/database.types';
import { CLIENT_MESSAGES } from '@/lib/clients/messages';

// ============================================================================
// Types
// ============================================================================

export interface ClientOwner {
  id: string;
  userId: string;
  email: string | null;
  role: 'owner' | 'staff';
  createdAt: string;
}

export interface ClientPendingInvite {
  id: string;
  createdAt: string;
  expiresAt: string;
  daysRemaining: number;
}

export interface ClientOwnerAccessData {
  isFirmAdmin: boolean;
  owners: ClientOwner[];
  pendingInvites: ClientPendingInvite[];
}

/**
 * Checks whether an error is a Next.js navigation redirect exception.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') || false)
  );
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Creates a single-use invitation for an SME business owner to access their portal.
 * Only firm admins have permission to issue invites.
 * Never logs the raw cryptographic token.
 *
 * @param clientId - The target client UUID
 * @returns ActionResult with the raw single-use token and complete invitation URL
 */
export async function createClientInviteAction(
  clientId: string
): Promise<ActionResult<{ rawToken: string; inviteUrl: string }>> {
  try {
    if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
      return { ok: false, message: 'A valid client identifier is required.' };
    }

    // 1. Enforce firm admin authorization
    const session = await requireFirmRole('staff');
    if (session.firm.role !== 'admin') {
      return { ok: false, message: CLIENT_MESSAGES.errors.onlyAdminCanInvite };
    }

    // 2. Call the atomic security-definer database function
    const supabase = await createServerClient<Database>();
    const { data: rawToken, error } = await supabase.rpc('create_client_invite', {
      p_client_id: clientId.trim(),
    });

    if (error || !rawToken) {
      return {
        ok: false,
        message: error?.message || 'Failed to generate invitation link. Please try again.',
      };
    }

    // 3. Assemble full invitation URL without ever logging the raw token
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
    const inviteUrl = `${siteUrl}/invite/${rawToken}`;

    return {
      ok: true,
      data: {
        rawToken,
        inviteUrl,
      },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Revokes a pending, unaccepted client invitation link.
 * Only firm admins have permission to revoke invites.
 *
 * @param inviteId - The invitation record UUID
 */
export async function revokeClientInviteAction(
  inviteId: string
): Promise<ActionResult<void>> {
  try {
    if (!inviteId || typeof inviteId !== 'string' || inviteId.trim() === '') {
      return { ok: false, message: 'A valid invite identifier is required.' };
    }

    // 1. Enforce firm admin authorization
    const session = await requireFirmRole('staff');
    if (session.firm.role !== 'admin') {
      return { ok: false, message: CLIENT_MESSAGES.errors.onlyAdminCanInvite };
    }

    // 2. Check existing invite status
    const supabase = await createServerClient<Database>();
    const { data: existingInvite } = await supabase
      .from('client_invites')
      .select('id, accepted_at')
      .eq('id', inviteId.trim())
      .is('deleted_at', null)
      .maybeSingle();

    if (!existingInvite) {
      return { ok: false, message: CLIENT_MESSAGES.errors.inviteNotFound };
    }

    if (existingInvite.accepted_at) {
      return { ok: false, message: CLIENT_MESSAGES.errors.inviteAlreadyAccepted };
    }

    // 3. Mark invite as revoked (soft-delete where accepted_at IS NULL)
    const { error } = await supabase
      .from('client_invites')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', inviteId.trim())
      .is('accepted_at', null);

    if (error) {
      return {
        ok: false,
        message: error.message || 'Failed to revoke the invitation link.',
      };
    }

    return {
      ok: true,
      data: undefined,
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Retrieves current active owners and pending unexpired invitations for a client.
 * Accessible to any firm member with access to the client.
 *
 * @param clientId - The client UUID
 */
export async function getClientOwnerAccessData(
  clientId: string
): Promise<ClientOwnerAccessData> {
  const session = await requireClientAccess(clientId);
  const isFirmAdmin = session.firm?.role === 'admin';
  const supabase = await createServerClient<Database>();

  // 1. Query active client owners from client_access
  const { data: accessRows } = await supabase
    .from('client_access')
    .select('id, user_id, role, created_at')
    .eq('client_id', clientId)
    .eq('role', 'owner')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const owners: ClientOwner[] = [];
  if (accessRows && accessRows.length > 0) {
    for (const row of accessRows) {
      let email: string | null = null;
      if (session.user && session.user.id === row.user_id && session.user.email) {
        email = session.user.email;
      }

      owners.push({
        id: row.id,
        userId: row.user_id,
        email,
        role: row.role as 'owner' | 'staff',
        createdAt: row.created_at,
      });
    }
  }

  // 2. Query active pending invites from client_invites
  let pendingInvites: ClientPendingInvite[] = [];
  const nowIso = new Date().toISOString();

  const { data: inviteRows } = await supabase
    .from('client_invites')
    .select('id, created_at, expires_at')
    .eq('client_id', clientId)
    .is('accepted_at', null)
    .is('deleted_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false });

  if (inviteRows && inviteRows.length > 0) {
    const nowMs = Date.now();
    pendingInvites = inviteRows.map((inv) => {
      const expiresMs = new Date(inv.expires_at).getTime();
      const diffMs = expiresMs - nowMs;
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        id: inv.id,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
        daysRemaining,
      };
    });
  }

  return {
    isFirmAdmin,
    owners,
    pendingInvites,
  };
}
