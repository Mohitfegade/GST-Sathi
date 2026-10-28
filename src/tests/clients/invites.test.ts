/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createClientInviteAction,
  revokeClientInviteAction,
} from '@/lib/clients/invite-actions';
import { CLIENT_MESSAGES } from '@/lib/clients/messages';
import type { User } from '@supabase/supabase-js';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest?: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

interface SimulatedInviteRow {
  id: string;
  firm_id: string;
  client_id: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

const firmId = '11111111-3333-4444-5555-666666666666';
const adminUser: User = { id: 'usr-admin-1', email: 'admin@firm.in' } as User;
const staffUser: User = { id: 'usr-staff-1', email: 'staff@firm.in' } as User;

let currentUser: User = adminUser;
let currentRole: 'admin' | 'staff' = 'admin';
let storedInvites: SimulatedInviteRow[] = [];

function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: null,
      }),
    },
    rpc: vi.fn((fnName: string, args: any) => {
      if (fnName === 'create_client_invite') {
        if (currentRole !== 'admin') {
          return Promise.resolve({ data: null, error: { message: 'Permission denied' } });
        }
        const rawToken = 'fake0000111122223333444455556666777788889999aaaabbbbccccddddeeee'; // 64 chars
        const tokenHash = 'fakehash1234567890abcdef';
        storedInvites.push({
          id: `inv-${crypto.randomUUID()}`,
          firm_id: firmId,
          client_id: args.p_client_id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          accepted_at: null,
          accepted_by: null,
          created_at: new Date().toISOString(),
          deleted_at: null,
        });
        return Promise.resolve({ data: rawToken, error: null });
      }
      return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
    }),
    from: vi.fn((table: string) => {
      if (table === 'firm_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    role: currentRole,
                    firm_id: firmId,
                    deleted_at: null,
                    firms: { id: firmId, name: 'Tax Firm', deleted_at: null },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'client_access') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn(async () => ({
                data: { id: 'client-1', firm_id: firmId },
                error: null,
              })),
            }),
          }),
        };
      }

      if (table === 'client_invites') {
        const filterCols: Array<{ col: string; val: any; isNull?: boolean }> = [];

        const executeDelete = () => {
          const matching = storedInvites.filter((inv) =>
            filterCols.every((f) =>
              f.isNull ? (inv as any)[f.col] === null : (inv as any)[f.col] === f.val
            )
          );
          for (const item of matching) {
            item.deleted_at = new Date().toISOString();
          }
          return { data: matching, error: null };
        };

        const inviteChain: any = {
          select: vi.fn(() => inviteChain),
          eq: vi.fn((col: string, val: any) => {
            filterCols.push({ col, val });
            return inviteChain;
          }),
          is: vi.fn((col: string, val: any) => {
            filterCols.push({ col, val, isNull: val === null });
            return inviteChain;
          }),
          maybeSingle: vi.fn(async () => {
            const matching = storedInvites.filter((inv) =>
              filterCols.every((f) =>
                f.isNull ? (inv as any)[f.col] === null : (inv as any)[f.col] === f.val
              )
            );
            return { data: matching[0] ?? null, error: null };
          }),
          update: vi.fn((updates: any) => {
            const updateChain: any = {
              eq: vi.fn((col: string, val: any) => {
                filterCols.push({ col, val });
                return updateChain;
              }),
              is: vi.fn((col: string, val: any) => {
                filterCols.push({ col, val, isNull: val === null });
                return updateChain;
              }),
              then: (resolve: any) => {
                const matching = storedInvites.filter((inv) =>
                  filterCols.every((f) =>
                    f.isNull ? (inv as any)[f.col] === null : (inv as any)[f.col] === f.val
                  )
                );
                for (const item of matching) {
                  Object.assign(item, updates);
                }
                resolve({ data: matching, error: null });
              },
            };
            return updateChain;
          }),
          delete: vi.fn(() => {
            return {
              eq: vi.fn((col1: string, val1: any) => {
                filterCols.push({ col: col1, val: val1 });
                return {
                  eq: vi.fn((col2: string, val2: any) => {
                    filterCols.push({ col: col2, val: val2 });
                    return {
                      is: vi.fn((col3: string, val3: any) => {
                        filterCols.push({ col: col3, val: val3, isNull: val3 === null });
                        return executeDelete();
                      }),
                      then: (resolve: any) => resolve(executeDelete()),
                    };
                  }),
                  then: (resolve: any) => resolve(executeDelete()),
                };
              }),
            };
          }),
        };
        return inviteChain;
      }

      return {};
    }),
  };
}

let mockSupabaseInstance: any;
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseInstance)),
}));

describe('Owner Access & Invite Tests (src/tests/clients/invites.test.ts)', () => {
  const clientId = 'c-100';

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = adminUser;
    currentRole = 'admin';
    storedInvites = [];
    mockSupabaseInstance = createMockSupabase();
  });

  it('allows firm admin to create a client invite and returns raw single-use token', async () => {
    const res = await createClientInviteAction(clientId);

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.rawToken).toBeDefined();
    expect(res.data.rawToken).toHaveLength(64); // 32-byte hex
    expect(res.data.inviteUrl).toContain(`/invite/${res.data.rawToken}`);

    // Verify stored invite contains hash, NOT raw token
    expect(storedInvites).toHaveLength(1);
    expect(storedInvites[0].token_hash).not.toBe(res.data.rawToken);
    expect(storedInvites[0].client_id).toBe(clientId);
  });

  it('strictly rejects firm staff attempting to create an invite', async () => {
    currentUser = staffUser;
    currentRole = 'staff';
    mockSupabaseInstance = createMockSupabase();

    const res = await createClientInviteAction(clientId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(CLIENT_MESSAGES.errors.onlyAdminCanInvite);
    }
    expect(storedInvites).toHaveLength(0);
  });

  it('allows firm admin to revoke a pending invite', async () => {
    const inviteId = 'inv-pending-1';
    storedInvites.push({
      id: inviteId,
      firm_id: firmId,
      client_id: clientId,
      token_hash: 'hash123',
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });

    const res = await revokeClientInviteAction(inviteId);
    expect(res.ok).toBe(true);
    expect(storedInvites[0].deleted_at).not.toBeNull();
  });

  it('strictly prevents revoking an invite that has already been accepted', async () => {
    const inviteId = 'inv-accepted-1';
    storedInvites.push({
      id: inviteId,
      firm_id: firmId,
      client_id: clientId,
      token_hash: 'hash456',
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      accepted_at: new Date().toISOString(),
      accepted_by: 'usr-owner-1',
      created_at: new Date().toISOString(),
      deleted_at: null,
    });

    const res = await revokeClientInviteAction(inviteId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toBe(CLIENT_MESSAGES.errors.inviteAlreadyAccepted);
    }
    expect(storedInvites[0].deleted_at).toBeNull();
  });
});
