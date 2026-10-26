import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { getSessionContext } from '../session';
import { requireUser } from '../require-user';
import { requireFirmRole, requireClientAccess } from '../roles';

// Mock Next.js navigation redirect
interface RedirectError extends Error {
  digest: string;
}

const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`) as RedirectError;
  error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase server client
const mockCreateServerClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => mockCreateServerClient(),
  createClient: () => mockCreateServerClient(),
}));

interface MockSupabaseOptions {
  user?: User | null;
  userError?: Error | null;
  firmMembers?: Array<Record<string, unknown>>;
  clientAccess?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
}

function buildMockSupabase(options: MockSupabaseOptions): SupabaseClient {
  const {
    user = { id: 'u1-uuid', email: 'accountant@example.com' } as User,
    userError = null,
    firmMembers = [],
    clientAccess = [],
    clients = [],
  } = options;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: userError,
      }),
    },
    from: vi.fn((table: string) => {
      let queryData: Array<Record<string, unknown>> = [];
      if (table === 'firm_members') queryData = firmMembers;
      else if (table === 'client_access') queryData = clientAccess;
      else if (table === 'clients') queryData = clients;

      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col: string, val: unknown) => {
          if (table === 'clients' && col === 'id') {
            queryData = queryData.filter((c) => c.id === val);
          }
          if (table === 'clients' && col === 'firm_id') {
            queryData = queryData.filter((c) => c.firm_id === val);
          }
          return chain;
        }),
        is: vi.fn((col: string, val: unknown) => {
          if (val === null) {
            queryData = queryData.filter((item) => item[col] === null || item[col] === undefined);
          }
          return chain;
        }),
        single: vi.fn(async () => ({
          data: queryData[0] ?? null,
          error: queryData[0] ? null : new Error('Row not found'),
        })),
        maybeSingle: vi.fn(async () => ({
          data: queryData[0] ?? null,
          error: null,
        })),
        then: (resolve: (val: { data: Array<Record<string, unknown>>; error: null }) => void) =>
          resolve({
            data: queryData,
            error: null,
          }),
      };

      return chain;
    }),
  } as unknown as SupabaseClient;
}

describe('Session Context & Role Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSessionContext', () => {
    it('returns null if auth.getUser returns an error', async () => {
      const mockSupabase = buildMockSupabase({
        user: null,
        userError: new Error('Session invalid'),
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).toBeNull();
    });

    it('returns null if auth.getUser returns a null user', async () => {
      const mockSupabase = buildMockSupabase({ user: null });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).toBeNull();
    });

    it('resolves Firm Admin profile: role admin, firm details, home /app', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-admin-1', email: 'admin@firm.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-101',
            firms: { id: 'firm-101', name: 'Kedia & Associates CA', deleted_at: null },
          },
        ],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('user-admin-1');
      expect(session?.firm).toEqual({
        id: 'firm-101',
        name: 'Kedia & Associates CA',
        role: 'admin',
      });
      expect(session?.clients).toEqual([]);
      expect(session?.home).toBe('/app');
    });

    it('resolves Firm Staff profile: role staff, home /app', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-staff-1', email: 'staff@firm.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-102',
            firms: { id: 'firm-102', name: 'Sharma Tax Consultancy', deleted_at: null },
          },
        ],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).not.toBeNull();
      expect(session?.firm).toEqual({
        id: 'firm-102',
        name: 'Sharma Tax Consultancy',
        role: 'staff',
      });
      expect(session?.home).toBe('/app');
    });

    it('resolves Client Owner profile: firm null, client owner, home /portal', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-owner-1', email: 'owner@shop.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-501',
            clients: {
              id: 'client-501',
              legal_name: 'Shree Ganesh Stationery & Xerox [FAKE]',
              trade_name: 'Ganesh Stationery [FAKE]',
              deleted_at: null,
            },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).not.toBeNull();
      expect(session?.firm).toBeNull();
      expect(session?.clients).toHaveLength(1);
      expect(session?.clients[0]).toEqual({
        id: 'client-501',
        name: 'Ganesh Stationery [FAKE]',
        role: 'owner',
      });
      expect(session?.home).toBe('/portal');
    });

    it('falls back to legal_name when trade_name is null', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-owner-2', email: 'owner2@shop.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-502',
            clients: {
              id: 'client-502',
              legal_name: 'Vidyarthi Book Depot Legal Entity',
              trade_name: null,
              deleted_at: null,
            },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session?.clients[0]?.name).toBe('Vidyarthi Book Depot Legal Entity');
      expect(session?.home).toBe('/portal');
    });

    it('resolves Client Staff only profile (no owner role, no firm) to /no-access', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-client-staff', email: 'staff@shop.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'staff',
            client_id: 'client-503',
            clients: {
              id: 'client-503',
              legal_name: 'Sai Krupa Kirana',
              trade_name: 'Sai Krupa Stores',
              deleted_at: null,
            },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session?.firm).toBeNull();
      expect(session?.clients[0]?.role).toBe('staff');
      expect(session?.home).toBe('/no-access');
    });

    it('resolves User with No Access to /no-access', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-unassigned', email: 'stranger@example.com' } as User,
        firmMembers: [],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session).not.toBeNull();
      expect(session?.firm).toBeNull();
      expect(session?.clients).toEqual([]);
      expect(session?.home).toBe('/no-access');
    });

    it('prioritizes firm home (/app) over client owner home (/portal) when user has both', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-dual-role', email: 'dual@example.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-99',
            firms: { id: 'firm-99', name: 'Dual Firm', deleted_at: null },
          },
        ],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-88',
            clients: { id: 'client-88', legal_name: 'Dual Client', trade_name: null, deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session?.firm).not.toBeNull();
      expect(session?.clients).toHaveLength(1);
      expect(session?.home).toBe('/app');
    });

    it('ignores soft-deleted firm members and soft-deleted firms', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-deleted-firm', email: 'deleted@firm.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-deleted-member',
            deleted_at: '2026-10-25T10:00:00Z',
            firms: { id: 'firm-deleted-member', name: 'Old Firm 1', deleted_at: null },
          },
          {
            role: 'admin',
            firm_id: 'firm-deleted-table',
            deleted_at: null,
            firms: { id: 'firm-deleted-table', name: 'Old Firm 2', deleted_at: '2026-10-25T10:00:00Z' },
          },
          {
            role: 'staff',
            firm_id: 'firm-active',
            deleted_at: null,
            firms: { id: 'firm-active', name: 'Active Firm', deleted_at: null },
          },
        ],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session?.firm).toEqual({
        id: 'firm-active',
        name: 'Active Firm',
        role: 'staff',
      });
      expect(session?.home).toBe('/app');
    });

    it('ignores soft-deleted client_access and soft-deleted clients', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-deleted-client', email: 'deleted@client.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-del-access',
            deleted_at: '2026-10-25T10:00:00Z',
            clients: { id: 'client-del-access', legal_name: 'Del Access', deleted_at: null },
          },
          {
            role: 'owner',
            client_id: 'client-del-row',
            deleted_at: null,
            clients: { id: 'client-del-row', legal_name: 'Del Client', deleted_at: '2026-10-25T10:00:00Z' },
          },
          {
            role: 'owner',
            client_id: 'client-active',
            deleted_at: null,
            clients: { id: 'client-active', legal_name: 'Active Client', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await getSessionContext();
      expect(session?.clients).toHaveLength(1);
      expect(session?.clients[0]?.id).toBe('client-active');
      expect(session?.home).toBe('/portal');
    });
  });

  describe('requireUser', () => {
    it('returns session context when user is authenticated', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'user-req-1', email: 'req@example.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-req',
            firms: { id: 'firm-req', name: 'Required Firm', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireUser();
      expect(session.user.id).toBe('user-req-1');
      expect(session.firm?.id).toBe('firm-req');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('redirects to /login if getSessionContext returns null', async () => {
      const mockSupabase = buildMockSupabase({ user: null });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT: /login');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('requireFirmRole', () => {
    it('allows Firm Admin when requiredRole is admin', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'admin-user', email: 'admin@firm.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-1',
            firms: { id: 'firm-1', name: 'Alpha Firm', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireFirmRole('admin');
      expect(session.firm.role).toBe('admin');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('allows Firm Admin when default requiredRole (staff) is requested', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'admin-user', email: 'admin@firm.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-1',
            firms: { id: 'firm-1', name: 'Alpha Firm', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireFirmRole();
      expect(session.firm.role).toBe('admin');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('allows Firm Staff when requiredRole is staff', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'staff-user', email: 'staff@firm.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-1',
            firms: { id: 'firm-1', name: 'Alpha Firm', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireFirmRole('staff');
      expect(session.firm.role).toBe('staff');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('redirects to session.home when Firm Staff attempts requiredRole admin', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'staff-user', email: 'staff@firm.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-1',
            firms: { id: 'firm-1', name: 'Alpha Firm', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireFirmRole('admin')).rejects.toThrow('NEXT_REDIRECT: /app');
      expect(mockRedirect).toHaveBeenCalledWith('/app');
    });

    it('redirects to session.home when user has no firm (e.g. Client Owner)', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'owner-user', email: 'owner@client.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'c1',
            clients: { id: 'c1', legal_name: 'Client 1', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireFirmRole('staff')).rejects.toThrow('NEXT_REDIRECT: /portal');
      expect(mockRedirect).toHaveBeenCalledWith('/portal');
    });

    it('redirects to session.home when user has no access at all', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'no-access-user', email: 'noaccess@example.com' } as User,
        firmMembers: [],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireFirmRole('staff')).rejects.toThrow('NEXT_REDIRECT: /no-access');
      expect(mockRedirect).toHaveBeenCalledWith('/no-access');
    });
  });

  describe('requireClientAccess', () => {
    it('succeeds when clientId matches direct client in session.clients', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'owner-user', email: 'owner@client.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-123',
            clients: { id: 'client-123', trade_name: 'My Store', legal_name: 'My Store LLP', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireClientAccess('client-123');
      expect(session.currentClient).toEqual({
        id: 'client-123',
        name: 'My Store',
        role: 'owner',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('succeeds via firm membership when client belongs to user firm in DB', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'firm-staff-user', email: 'staff@firm.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-xyz',
            firms: { id: 'firm-xyz', name: 'XYZ CA Firm', deleted_at: null },
          },
        ],
        clientAccess: [], // No direct client_access
        clients: [
          {
            id: 'client-under-firm',
            firm_id: 'firm-xyz',
            trade_name: 'Firm Client Store',
            legal_name: 'Firm Client Legal',
            deleted_at: null,
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireClientAccess('client-under-firm');
      expect(session.currentClient).toEqual({
        id: 'client-under-firm',
        name: 'Firm Client Store',
        role: 'staff',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('redirects to session.home if firm user attempts access to client not belonging to their firm', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'firm-staff-user', email: 'staff@firm.com' } as User,
        firmMembers: [
          {
            role: 'staff',
            firm_id: 'firm-xyz',
            firms: { id: 'firm-xyz', name: 'XYZ CA Firm', deleted_at: null },
          },
        ],
        clientAccess: [],
        clients: [], // Client not in this firm
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireClientAccess('client-other-firm')).rejects.toThrow('NEXT_REDIRECT: /app');
      expect(mockRedirect).toHaveBeenCalledWith('/app');
    });

    it('redirects to session.home if non-firm user attempts access to client not in direct access', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'owner-user', email: 'owner@client.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-my-own',
            clients: { id: 'client-my-own', legal_name: 'My Shop', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireClientAccess('client-other-store')).rejects.toThrow('NEXT_REDIRECT: /portal');
      expect(mockRedirect).toHaveBeenCalledWith('/portal');
    });

    it('without clientId: returns session with first client for Client Owner', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'owner-user', email: 'owner@client.com' } as User,
        firmMembers: [],
        clientAccess: [
          {
            role: 'owner',
            client_id: 'client-default',
            clients: { id: 'client-default', trade_name: 'Default Store', deleted_at: null },
          },
        ],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireClientAccess();
      expect(session.currentClient?.id).toBe('client-default');
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('without clientId: succeeds for Firm Member', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'firm-user', email: 'ca@firm.com' } as User,
        firmMembers: [
          {
            role: 'admin',
            firm_id: 'firm-abc',
            firms: { id: 'firm-abc', name: 'ABC Firm', deleted_at: null },
          },
        ],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      const session = await requireClientAccess();
      expect(session.currentClient).toBeUndefined();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('without clientId: redirects to /no-access for unassigned user', async () => {
      const mockSupabase = buildMockSupabase({
        user: { id: 'unassigned-user', email: 'stranger@example.com' } as User,
        firmMembers: [],
        clientAccess: [],
      });
      mockCreateServerClient.mockResolvedValue(mockSupabase);

      await expect(requireClientAccess()).rejects.toThrow('NEXT_REDIRECT: /no-access');
      expect(mockRedirect).toHaveBeenCalledWith('/no-access');
    });
  });
});
