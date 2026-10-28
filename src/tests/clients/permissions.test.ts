/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createClient,
  updateClient,
  archiveClient,
  restoreClient,
} from '@/lib/clients/actions';
import { CLIENT_MESSAGES } from '@/lib/clients/messages';
import { generateFakeGstin } from '@/lib/gst/gstin';
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

interface SimulatedClientRow {
  id: string;
  firm_id: string;
  legal_name: string;
  trade_name: string | null;
  gstin: string;
  state_code: string;
  scheme: 'regular' | 'qrmp' | 'composition' | 'unregistered';
  aato_band: 'below_40l' | '40l_to_1_5cr' | '1_5cr_to_5cr' | 'above_5cr';
  fy_start_month: number;
  language: 'en' | 'hi' | 'mr';
  sells_exempt: boolean;
  sells_taxable: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MockStore {
  currentUser: User;
  firmId: string;
  firmRole: 'admin' | 'staff';
  clients: SimulatedClientRow[];
}

let mockStore: MockStore;

function createMockSupabase(store: MockStore) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: store.currentUser },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'firm_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    role: store.firmRole,
                    firm_id: store.firmId,
                    deleted_at: null,
                    firms: { id: store.firmId, name: 'Apex Firm', deleted_at: null },
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
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'clients') {
        const filterCols: Array<{ col: string; val: any; isNull?: boolean; isNeq?: boolean }> = [];
        const executeUpdate = (updates: any) => {
          const targets = store.clients.filter((c: any) =>
            filterCols.every((f) =>
              f.isNull
                ? c[f.col] === null
                : f.isNeq
                ? c[f.col] !== f.val
                : c[f.col] === f.val
            )
          );
          for (const target of targets) {
            Object.assign(target, updates, {
              updated_at: new Date().toISOString(),
            });
          }
          return { data: targets.length > 0 ? { id: targets[0].id } : null, error: null };
        };

        const chain: any = {
          select: vi.fn((_cols?: string) => chain),
          eq: vi.fn((col: string, val: any) => {
            filterCols.push({ col, val });
            return chain;
          }),
          neq: vi.fn((col: string, val: any) => {
            filterCols.push({ col, val, isNeq: true });
            return chain;
          }),
          is: vi.fn((col: string, val: any) => {
            filterCols.push({ col, val, isNull: val === null });
            return chain;
          }),
          maybeSingle: vi.fn(async () => {
            const targets = store.clients.filter((c: any) =>
              filterCols.every((f) =>
                f.isNull
                  ? c[f.col] === null
                  : f.isNeq
                  ? c[f.col] !== f.val
                  : c[f.col] === f.val
              )
            );
            return { data: targets[0] ?? null, error: null };
          }),
          single: vi.fn(async () => {
            const targets = store.clients.filter((c: any) =>
              filterCols.every((f) => (f.isNull ? c[f.col] === null : c[f.col] === f.val))
            );
            return { data: targets[0] ?? null, error: targets[0] ? null : new Error('Not found') };
          }),
          insert: vi.fn((payload: any) => {
            const newId = `c-${crypto.randomUUID()}`;
            store.clients.push({
              id: newId,
              firm_id: payload.firm_id,
              legal_name: payload.legal_name,
              trade_name: payload.trade_name ?? null,
              gstin: payload.gstin,
              state_code: payload.state_code,
              scheme: payload.scheme ?? 'regular',
              aato_band: payload.aato_band ?? 'below_40l',
              fy_start_month: 4,
              language: 'en',
              sells_exempt: false,
              sells_taxable: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            });
            return {
              select: () => ({
                single: async () => ({ data: { id: newId }, error: null }),
              }),
            };
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
              select: vi.fn(() => ({
                maybeSingle: async () => executeUpdate(updates),
              })),
              then: (resolve: any) => resolve(executeUpdate(updates)),
            };
            return updateChain;
          }),
        };
        return chain;
      }

      return {};
    }),
  };
}

let mockSupabase: any;
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Client Role Permissions Tests (src/tests/clients/permissions.test.ts)', () => {
  const firmId = '11111111-2222-3333-4444-555555555555';
  const staffUser: User = { id: 'usr-staff-1', email: 'staff@apexfirm.in' } as User;
  const adminUser: User = { id: 'usr-admin-1', email: 'admin@apexfirm.in' } as User;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows firm staff to create a new client business', async () => {
    mockStore = {
      currentUser: staffUser,
      firmId,
      firmRole: 'staff',
      clients: [],
    };
    mockSupabase = createMockSupabase(mockStore);

    const gstin = generateFakeGstin('27');
    const result = await createClient({
      legal_name: 'Staff Added Retailers',
      gstin,
      scheme: 'regular',
      aato_band: 'below_40l',
      sells_taxable: true,
      sells_exempt: false,
      language: 'en',
    });

    expect(result.ok).toBe(true);
    expect(mockStore.clients).toHaveLength(1);
    expect(mockStore.clients[0].legal_name).toBe('Staff Added Retailers');
  });

  it('allows firm staff to edit existing client business details', async () => {
    const clientId = 'c-target-1';
    mockStore = {
      currentUser: staffUser,
      firmId,
      firmRole: 'staff',
      clients: [
        {
          id: clientId,
          firm_id: firmId,
          legal_name: 'Original Store',
          trade_name: 'Original',
          gstin: generateFakeGstin('27'),
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ],
    };
    mockSupabase = createMockSupabase(mockStore);

    const result = await updateClient(clientId, {
      legal_name: 'Updated Store Name',
      trade_name: 'Updated',
      gstin: mockStore.clients[0].gstin,
      scheme: 'regular',
      aato_band: 'below_40l',
      sells_taxable: true,
      sells_exempt: false,
      language: 'en',
    });

    expect(result.ok).toBe(true);
    expect(mockStore.clients[0].legal_name).toBe('Updated Store Name');
  });

  it('strictly rejects firm staff attempting to archive a client', async () => {
    const clientId = 'c-target-2';
    mockStore = {
      currentUser: staffUser,
      firmId,
      firmRole: 'staff',
      clients: [
        {
          id: clientId,
          firm_id: firmId,
          legal_name: 'Store To Archive',
          trade_name: null,
          gstin: generateFakeGstin('27'),
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ],
    };
    mockSupabase = createMockSupabase(mockStore);

    const result = await archiveClient(clientId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(CLIENT_MESSAGES.errors.onlyAdminCanArchive);
    }
    expect(mockStore.clients[0].deleted_at).toBeNull();
  });

  it('strictly rejects firm staff attempting to restore a client', async () => {
    const clientId = 'c-target-3';
    mockStore = {
      currentUser: staffUser,
      firmId,
      firmRole: 'staff',
      clients: [
        {
          id: clientId,
          firm_id: firmId,
          legal_name: 'Hidden Store',
          trade_name: null,
          gstin: generateFakeGstin('27'),
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: new Date().toISOString(),
        },
      ],
    };
    mockSupabase = createMockSupabase(mockStore);

    const result = await restoreClient(clientId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(CLIENT_MESSAGES.errors.onlyAdminCanRestore);
    }
    expect(mockStore.clients[0].deleted_at).not.toBeNull();
  });

  it('allows firm admin to archive and restore clients', async () => {
    const clientId = 'c-target-4';
    mockStore = {
      currentUser: adminUser,
      firmId,
      firmRole: 'admin',
      clients: [
        {
          id: clientId,
          firm_id: firmId,
          legal_name: 'Admin Managed Store',
          trade_name: null,
          gstin: generateFakeGstin('27'),
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ],
    };
    mockSupabase = createMockSupabase(mockStore);

    const archiveRes = await archiveClient(clientId);
    expect(archiveRes.ok).toBe(true);
    expect(mockStore.clients[0].deleted_at).not.toBeNull();

    const restoreRes = await restoreClient(clientId);
    expect(restoreRes.ok).toBe(true);
    expect(mockStore.clients[0].deleted_at).toBeNull();
  });
});
