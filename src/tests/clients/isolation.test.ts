/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateClient, archiveClient } from '@/lib/clients/actions';
import { getClientById, listClients } from '@/lib/clients/queries';
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

const firmAId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const firmBId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const userFirmA: User = { id: 'usr-a', email: 'accountant@firm-a.in' } as User;

let allClients: SimulatedClientRow[] = [];

function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userFirmA },
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
                    role: 'admin',
                    firm_id: firmAId,
                    deleted_at: null,
                    firms: { id: firmAId, name: 'Firm A', deleted_at: null },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'client_access' || table === 'client_invites' || table === 'return_periods' || table === 'documents') {
        const dummyChain: any = {
          in: vi.fn(() => dummyChain),
          eq: vi.fn(() => dummyChain),
          is: vi.fn(() => dummyChain),
          gt: vi.fn(() => dummyChain),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
        return {
          select: vi.fn(() => dummyChain),
        };
      }

      if (table === 'clients') {
        const filterCols: Array<{ col: string; val: any; isNull?: boolean; isNeq?: boolean }> = [];

        const executeUpdate = (updates: any) => {
          const targets = allClients.filter((c: any) =>
            filterCols.every((f) =>
              f.isNull ? c[f.col] === null : f.isNeq ? c[f.col] !== f.val : c[f.col] === f.val
            )
          );
          for (const target of targets) {
            Object.assign(target, updates, { updated_at: new Date().toISOString() });
          }
          return { data: targets.length > 0 ? { id: targets[0].id } : null, error: null };
        };

        const chain: any = {
          select: vi.fn((_cols?: string, options?: any) => {
            if (options?.count) {
              const matches = allClients.filter((c: any) =>
                filterCols.every((f) =>
                  f.isNull ? c[f.col] === null : f.isNeq ? c[f.col] !== f.val : c[f.col] === f.val
                )
              );
              return {
                ...chain,
                then: (resolve: any) =>
                  resolve({ data: matches, count: matches.length, error: null }),
              };
            }
            return chain;
          }),
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
          or: vi.fn((_cond: string) => chain),
          order: vi.fn((_col: string) => chain),
          range: vi.fn((_from: number, _to: number) => {
            const matches = allClients.filter((c: any) =>
              filterCols.every((f) =>
                f.isNull ? c[f.col] === null : f.isNeq ? c[f.col] !== f.val : c[f.col] === f.val
              )
            );
            return {
              ...chain,
              then: (resolve: any) =>
                resolve({ data: matches, count: matches.length, error: null }),
            };
          }),
          maybeSingle: vi.fn(async () => {
            const targets = allClients.filter((c: any) =>
              filterCols.every((f) =>
                f.isNull ? c[f.col] === null : f.isNeq ? c[f.col] !== f.val : c[f.col] === f.val
              )
            );
            return { data: targets[0] ?? null, error: null };
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

let mockSupabaseInstance: any;
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabaseInstance)),
}));

describe('Multi-Tenant Client Isolation Tests (src/tests/clients/isolation.test.ts)', () => {
  const clientAId = 'client-firm-a-1';
  const clientBId = 'client-firm-b-1';

  beforeEach(() => {
    vi.clearAllMocks();

    allClients = [
      {
        id: clientAId,
        firm_id: firmAId,
        legal_name: 'Firm A Retail',
        trade_name: 'A-Shop',
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
      {
        id: clientBId,
        firm_id: firmBId,
        legal_name: 'Firm B Wholesale',
        trade_name: 'B-Shop',
        gstin: generateFakeGstin('24'),
        state_code: '24',
        scheme: 'composition',
        aato_band: '40l_to_1_5cr',
        fy_start_month: 4,
        language: 'en',
        sells_exempt: false,
        sells_taxable: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ];

    mockSupabaseInstance = createMockSupabase();
  });

  it('Firm A client listing returns only Firm A clients, strictly excluding Firm B clients', async () => {
    const listRes = await listClients({}, mockSupabaseInstance, firmAId);

    expect(listRes.items).toHaveLength(1);
    expect(listRes.items[0].id).toBe(clientAId);
    expect(listRes.items[0].names.legal_name).toBe('Firm A Retail');
    expect(listRes.items.some((c) => c.id === clientBId)).toBe(false);
  });

  it('Firm A accountant cannot get a Firm B client by ID (returns null)', async () => {
    const clientRes = await getClientById(clientBId, mockSupabaseInstance, firmAId);
    expect(clientRes).toBeNull();
  });

  it('Firm A accountant cannot update a Firm B client', async () => {
    const updateRes = await updateClient(clientBId, {
      legal_name: 'Malicious Update Attempt',
      gstin: generateFakeGstin('24'),
      scheme: 'regular',
      aato_band: 'below_40l',
      sells_taxable: true,
      sells_exempt: false,
      language: 'en',
    });

    expect(updateRes.ok).toBe(false);
    if (!updateRes.ok) {
      expect(updateRes.message).toBe(CLIENT_MESSAGES.errors.clientNotFound);
    }

    const clientB = allClients.find((c) => c.id === clientBId);
    expect(clientB?.legal_name).toBe('Firm B Wholesale');
  });

  it('Firm A accountant cannot archive a Firm B client', async () => {
    const archiveRes = await archiveClient(clientBId);

    expect(archiveRes.ok).toBe(false);
    if (!archiveRes.ok) {
      expect(archiveRes.message).toBe(CLIENT_MESSAGES.errors.clientNotFound);
    }

    const clientB = allClients.find((c) => c.id === clientBId);
    expect(clientB?.deleted_at).toBeNull();
  });
});
