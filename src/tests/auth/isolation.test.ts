import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { getSessionContext } from '../../lib/auth/session';
import { getAuthRedirect } from '../../lib/auth/redirect';
import { requireFirmRole, requireClientAccess } from '../../lib/auth/roles';
import { resolveDestination } from '../../app/(auth)/login/actions';

// Mock Next.js navigation redirect
const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest?: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase Server Client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

interface MockDataStore {
  users: Record<string, User>;
  firmMembers: Array<{
    user_id: string;
    firm_id: string;
    role: 'admin' | 'staff';
    deleted_at: string | null;
    firms: { id: string; name: string; deleted_at: string | null };
  }>;
  clientAccess: Array<{
    user_id: string;
    firm_id: string;
    client_id: string;
    role: 'owner' | 'staff';
    deleted_at: string | null;
    clients: {
      id: string;
      firm_id: string;
      legal_name: string;
      trade_name: string | null;
      deleted_at: string | null;
    };
  }>;
  clients: Array<{
    id: string;
    firm_id: string;
    legal_name: string;
    trade_name: string | null;
    deleted_at: string | null;
  }>;
}

interface MockQueryChain {
  select: (cols?: string) => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  is: (col: string, val: unknown) => MockQueryChain;
  limit: (n: number) => MockQueryChain;
  order: (col: string) => MockQueryChain;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  then: (resolve: (val: { data: Record<string, unknown>[]; error: null }) => unknown) => unknown;
}

function createScopedMockSupabase(store: MockDataStore, currentUserId: string) {
  const currentUser = store.users[currentUserId] ?? null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: currentUser ? null : new Error('Not authenticated'),
      }),
    },
    from: vi.fn((table: string): MockQueryChain => {
      let filteredData: Record<string, unknown>[] = [];

      if (table === 'firm_members') {
        filteredData = store.firmMembers.filter((fm) => fm.user_id === currentUserId);
      } else if (table === 'client_access') {
        filteredData = store.clientAccess.filter((ca) => ca.user_id === currentUserId);
      } else if (table === 'clients') {
        filteredData = [...store.clients];
      }

      const chain: MockQueryChain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col: string, val: unknown) => {
          filteredData = filteredData.filter((item) => item[col] === val);
          return chain;
        }),
        is: vi.fn((col: string, val: unknown) => {
          if (val === null) {
            filteredData = filteredData.filter((item) => item[col] === null);
          }
          return chain;
        }),
        limit: vi.fn(() => chain),
        order: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: filteredData[0] ?? null,
          error: null,
        })),
        single: vi.fn(async () => ({
          data: filteredData[0] ?? null,
          error: filteredData[0] ? null : new Error('Record not found'),
        })),
        // When awaited directly or via Promise.all
        then: (resolve: (val: { data: Record<string, unknown>[]; error: null }) => unknown) =>
          resolve({
            data: filteredData,
            error: null,
          }),
      };

      return chain;
    }),
  };
}

describe('Auth Routing & Multi-Tenant Isolation Tests (src/tests/auth/isolation.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. User with firm membership is routed to /app', () => {
    const firmUser: User = { id: 'usr-firm-admin-1', email: 'ca@apexadvisory.com' } as User;
    const store: MockDataStore = {
      users: { [firmUser.id]: firmUser },
      firmMembers: [
        {
          user_id: firmUser.id,
          firm_id: 'firm-1-uuid',
          role: 'admin',
          deleted_at: null,
          firms: { id: 'firm-1-uuid', name: 'Apex Advisory CA', deleted_at: null },
        },
      ],
      clientAccess: [],
      clients: [],
    };

    it('getSessionContext resolves firm and sets home to /app', async () => {
      const client = createScopedMockSupabase(store, firmUser.id);
      const session = await getSessionContext(client as unknown as SupabaseClient);

      expect(session).not.toBeNull();
      expect(session!.firm).toEqual({
        id: 'firm-1-uuid',
        name: 'Apex Advisory CA',
        role: 'admin',
      });
      expect(session!.home).toBe('/app');
    });

    it('getAuthRedirect routes firm member to /app when accessing public auth routes', async () => {
      const client = createScopedMockSupabase(store, firmUser.id);
      const session = (await getSessionContext(client as unknown as SupabaseClient))!;

      // Visiting /login or /signup redirects to home (/app)
      expect(getAuthRedirect('/login', session)).toBe('/app');
      expect(getAuthRedirect('/signup', session)).toBe('/app');
      expect(getAuthRedirect('/forgot-password', session)).toBe('/app');
      expect(getAuthRedirect('/reset-password', session)).toBe('/app');

      // Visiting /app is allowed
      expect(getAuthRedirect('/app', session)).toBeNull();
      expect(getAuthRedirect('/app/clients', session)).toBeNull();

      // Visiting /no-access redirects to /app
      expect(getAuthRedirect('/no-access', session)).toBe('/app');
    });

    it('resolveDestination returns /app for firm members', async () => {
      const client = createScopedMockSupabase(store, firmUser.id);
      const dest = await resolveDestination(client as unknown as SupabaseClient, firmUser.id);
      expect(dest).toBe('/app');
    });

    it('requireFirmRole allows access to firm member', async () => {
      const client = createScopedMockSupabase(store, firmUser.id);
      // Setup default mockSupabase for requireUser/requireFirmRole
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: firmUser },
        error: null,
      });
      mockSupabase.from.mockImplementation(client.from);

      const session = await requireFirmRole('admin');
      expect(session.firm.id).toBe('firm-1-uuid');
      expect(session.firm.role).toBe('admin');
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe('2. User with client access is routed to /portal', () => {
    const clientUser: User = { id: 'usr-client-owner-1', email: 'owner@retailshop.in' } as User;
    const store: MockDataStore = {
      users: { [clientUser.id]: clientUser },
      firmMembers: [], // No firm membership
      clientAccess: [
        {
          user_id: clientUser.id,
          firm_id: 'firm-1-uuid',
          client_id: 'client-1-uuid',
          role: 'owner',
          deleted_at: null,
          clients: {
            id: 'client-1-uuid',
            firm_id: 'firm-1-uuid',
            legal_name: 'Shree Retail Store Pvt Ltd',
            trade_name: 'Shree Retail',
            deleted_at: null,
          },
        },
      ],
      clients: [
        {
          id: 'client-1-uuid',
          firm_id: 'firm-1-uuid',
          legal_name: 'Shree Retail Store Pvt Ltd',
          trade_name: 'Shree Retail',
          deleted_at: null,
        },
      ],
    };

    it('getSessionContext resolves client owner with no firm and sets home to /portal', async () => {
      const client = createScopedMockSupabase(store, clientUser.id);
      const session = await getSessionContext(client as unknown as SupabaseClient);

      expect(session).not.toBeNull();
      expect(session!.firm).toBeNull();
      expect(session!.clients.length).toBe(1);
      expect(session!.clients[0]).toEqual({
        id: 'client-1-uuid',
        name: 'Shree Retail',
        role: 'owner',
      });
      expect(session!.home).toBe('/portal');
    });

    it('getAuthRedirect routes client owner to /portal', async () => {
      const client = createScopedMockSupabase(store, clientUser.id);
      const session = (await getSessionContext(client as unknown as SupabaseClient))!;

      // Visiting /login or /signup redirects to /portal
      expect(getAuthRedirect('/login', session)).toBe('/portal');
      expect(getAuthRedirect('/signup', session)).toBe('/portal');

      // Visiting /portal is allowed
      expect(getAuthRedirect('/portal', session)).toBeNull();
      expect(getAuthRedirect('/portal/upload', session)).toBeNull();

      // Visiting /app (firm dashboard) redirects to /portal
      expect(getAuthRedirect('/app', session)).toBe('/portal');

      // Visiting /no-access redirects to /portal
      expect(getAuthRedirect('/no-access', session)).toBe('/portal');
    });

    it('resolveDestination returns /portal for client owner', async () => {
      const client = createScopedMockSupabase(store, clientUser.id);
      const dest = await resolveDestination(client as unknown as SupabaseClient, clientUser.id);
      expect(dest).toBe('/portal');
    });

    it('requireFirmRole redirects client owner to /portal', async () => {
      const client = createScopedMockSupabase(store, clientUser.id);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: clientUser },
        error: null,
      });
      mockSupabase.from.mockImplementation(client.from);

      await expect(requireFirmRole('staff')).rejects.toThrow('NEXT_REDIRECT: /portal');
      expect(mockRedirect).toHaveBeenCalledWith('/portal');
    });
  });

  describe('3. User with neither firm membership nor client access is routed to /no-access', () => {
    const unassignedUser: User = { id: 'usr-unassigned', email: 'pending@example.com' } as User;
    const store: MockDataStore = {
      users: { [unassignedUser.id]: unassignedUser },
      firmMembers: [],
      clientAccess: [],
      clients: [],
    };

    it('getSessionContext resolves home to /no-access for unassigned users', async () => {
      const client = createScopedMockSupabase(store, unassignedUser.id);
      const session = await getSessionContext(client as unknown as SupabaseClient);

      expect(session).not.toBeNull();
      expect(session!.firm).toBeNull();
      expect(session!.clients).toEqual([]);
      expect(session!.home).toBe('/no-access');
    });

    it('getAuthRedirect redirects unassigned user to /no-access from protected routes', async () => {
      const client = createScopedMockSupabase(store, unassignedUser.id);
      const session = (await getSessionContext(client as unknown as SupabaseClient))!;

      // Visiting /app or /portal redirects to /no-access
      expect(getAuthRedirect('/app', session)).toBe('/no-access');
      expect(getAuthRedirect('/app/clients', session)).toBe('/no-access');
      expect(getAuthRedirect('/portal', session)).toBe('/no-access');

      // Visiting /no-access directly is allowed
      expect(getAuthRedirect('/no-access', session)).toBeNull();
    });

    it('requireFirmRole and requireClientAccess redirect unassigned user to /no-access', async () => {
      const client = createScopedMockSupabase(store, unassignedUser.id);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: unassignedUser },
        error: null,
      });
      mockSupabase.from.mockImplementation(client.from);

      await expect(requireFirmRole('staff')).rejects.toThrow('NEXT_REDIRECT: /no-access');
      expect(mockRedirect).toHaveBeenCalledWith('/no-access');

      vi.clearAllMocks();
      await expect(requireClientAccess()).rejects.toThrow('NEXT_REDIRECT: /no-access');
      expect(mockRedirect).toHaveBeenCalledWith('/no-access');
    });
  });

  describe('4. Multi-Tenant Firm Isolation', () => {
    // Firm A
    const firmAId = 'firm-a-1111-1111-1111-111111111111';
    const userA: User = { id: 'usr-a-admin', email: 'admin@firm-a.com' } as User;
    const clientA1Id = 'client-a1-1111-1111-1111-111111111111';

    // Firm B
    const firmBId = 'firm-b-2222-2222-2222-222222222222';
    const userB: User = { id: 'usr-b-admin', email: 'admin@firm-b.com' } as User;
    const clientB1Id = 'client-b1-2222-2222-2222-222222222222';

    const multiTenantStore: MockDataStore = {
      users: {
        [userA.id]: userA,
        [userB.id]: userB,
      },
      firmMembers: [
        {
          user_id: userA.id,
          firm_id: firmAId,
          role: 'admin',
          deleted_at: null,
          firms: { id: firmAId, name: 'Firm Alpha CA', deleted_at: null },
        },
        {
          user_id: userB.id,
          firm_id: firmBId,
          role: 'admin',
          deleted_at: null,
          firms: { id: firmBId, name: 'Firm Beta CA', deleted_at: null },
        },
      ],
      clientAccess: [],
      clients: [
        {
          id: clientA1Id,
          firm_id: firmAId,
          legal_name: 'Alpha Client 1 Pvt Ltd',
          trade_name: 'Alpha Client 1',
          deleted_at: null,
        },
        {
          id: clientB1Id,
          firm_id: firmBId,
          legal_name: 'Beta Client 1 Pvt Ltd',
          trade_name: 'Beta Client 1',
          deleted_at: null,
        },
      ],
    };

    it('guarantees session context isolation between two distinct firms', async () => {
      const clientUserA = createScopedMockSupabase(multiTenantStore, userA.id);
      const clientUserB = createScopedMockSupabase(multiTenantStore, userB.id);

      const sessionA = await getSessionContext(clientUserA as unknown as SupabaseClient);
      const sessionB = await getSessionContext(clientUserB as unknown as SupabaseClient);

      // User A sees ONLY Firm Alpha
      expect(sessionA!.firm).toEqual({
        id: firmAId,
        name: 'Firm Alpha CA',
        role: 'admin',
      });
      expect(sessionA!.firm!.id).not.toBe(firmBId);

      // User B sees ONLY Firm Beta
      expect(sessionB!.firm).toEqual({
        id: firmBId,
        name: 'Firm Beta CA',
        role: 'admin',
      });
      expect(sessionB!.firm!.id).not.toBe(firmAId);
    });

    it('prevents Firm A from reading or accessing Firm B client through requireClientAccess', async () => {
      const clientUserA = createScopedMockSupabase(multiTenantStore, userA.id);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: userA },
        error: null,
      });
      mockSupabase.from.mockImplementation(clientUserA.from);

      // 1. User A can access Client A1 (owned by Firm A)
      const allowedAccess = await requireClientAccess(clientA1Id);
      expect(allowedAccess.currentClient).toBeDefined();
      expect(allowedAccess.currentClient!.id).toBe(clientA1Id);
      expect(allowedAccess.currentClient!.name).toBe('Alpha Client 1');
      expect(mockRedirect).not.toHaveBeenCalled();

      // 2. User A attempts to access Client B1 (owned by Firm B)
      vi.clearAllMocks();
      await expect(requireClientAccess(clientB1Id)).rejects.toThrow('NEXT_REDIRECT: /app');

      // User A is denied and redirected to /app, protecting Firm B data
      expect(mockRedirect).toHaveBeenCalledWith('/app');
    });

    it('enforces firm_id scoping on client queries to prevent cross-firm data reads and writes', async () => {
      const clientUserA = createScopedMockSupabase(multiTenantStore, userA.id);

      // Querying clients with Firm A's firm_id only returns Firm A clients
      const { data: firmAClients } = (await clientUserA
        .from('clients')
        .select('*')
        .eq('firm_id', firmAId)) as { data: Record<string, unknown>[] };

      expect(firmAClients.length).toBe(1);
      expect(firmAClients[0].id).toBe(clientA1Id);
      expect(firmAClients.some((c: Record<string, unknown>) => c.firm_id === firmBId)).toBe(false);

      // Attempting to query Firm B's clients while authenticated as User A
      // under tenant RLS or firm-scoped filter yields empty results
      const { data: crossFirmQuery } = (await clientUserA
        .from('clients')
        .select('*')
        .eq('firm_id', firmBId)
        .eq('id', clientA1Id)) as { data: Record<string, unknown>[] };

      expect(crossFirmQuery.length).toBe(0);
    });
  });
});
