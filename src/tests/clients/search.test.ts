/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listClients } from '@/lib/clients/queries';
import { generateFakeGstin } from '@/lib/gst/gstin';
import type { User } from '@supabase/supabase-js';

const firmId = '11111111-4444-5555-6666-777777777777';
const user: User = { id: 'usr-search-1', email: 'accountant@searchfirm.in' } as User;

interface FakeClientRow {
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

let mockClients: FakeClientRow[] = [];

function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
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
                    role: 'staff',
                    firm_id: firmId,
                    deleted_at: null,
                    firms: { id: firmId, name: 'Search Firm', deleted_at: null },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (
        table === 'client_access' ||
        table === 'client_invites' ||
        table === 'return_periods' ||
        table === 'documents'
      ) {
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
        let currentFiltered = mockClients.filter(
          (c) => c.firm_id === firmId && c.deleted_at === null
        );

        const queryChain: any = {
          select: vi.fn((_cols?: string, _opts?: any) => queryChain),
          eq: vi.fn((col: string, val: any) => {
            currentFiltered = currentFiltered.filter((c: any) => c[col] === val);
            return queryChain;
          }),
          is: vi.fn((col: string, val: any) => {
            if (val === null) {
              currentFiltered = currentFiltered.filter((c: any) => c[col] === null);
            }
            return queryChain;
          }),
          or: vi.fn((orString: string) => {
            // Parses e.g. "legal_name.ilike.%sharma%,trade_name.ilike.%sharma%,gstin.ilike.%sharma%"
            const match = orString.match(/%([^%]+)%/);
            if (match) {
              const term = match[1].toLowerCase();
              currentFiltered = currentFiltered.filter(
                (c) =>
                  c.legal_name.toLowerCase().includes(term) ||
                  (c.trade_name && c.trade_name.toLowerCase().includes(term)) ||
                  c.gstin.toLowerCase().includes(term)
              );
            }
            return queryChain;
          }),
          order: vi.fn((_col: string, _opts?: any) => queryChain),
          range: vi.fn((from: number, to: number) => {
            const totalCount = currentFiltered.length;
            const pagedSlice = currentFiltered.slice(from, to + 1);
            return {
              then: (resolve: any) =>
                resolve({
                  data: pagedSlice,
                  count: totalCount,
                  error: null,
                }),
            };
          }),
        };

        return queryChain;
      }

      return {};
    }),
  };
}

let mockSupabaseInstance: any;

describe('Client Search, Filtering & Pagination Tests (src/tests/clients/search.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockClients = [];
    // Generate 30 fake clients: 15 regular, 10 qrmp, 5 composition
    for (let i = 1; i <= 30; i++) {
      const scheme = i <= 15 ? 'regular' : i <= 25 ? 'qrmp' : 'composition';
      const legal_name = i === 1 ? 'Special Sharma Sweets' : `Client Retail ${i}`;
      const trade_name = i === 2 ? 'Special Kirana' : `Shop ${i}`;
      const gstin = i === 3 ? '27FAKETEST1234Z8' : generateFakeGstin('27');

      mockClients.push({
        id: `client-${i}`,
        firm_id: firmId,
        legal_name,
        trade_name,
        gstin,
        state_code: '27',
        scheme,
        aato_band: 'below_40l',
        fy_start_month: 4,
        language: 'en',
        sells_exempt: false,
        sells_taxable: true,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });
    }

    mockSupabaseInstance = createMockSupabase();
  });

  it('filters clients by search matching legal_name', async () => {
    const res = await listClients({ search: 'Sharma' }, mockSupabaseInstance, firmId);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].names.legal_name).toBe('Special Sharma Sweets');
  });

  it('filters clients by search matching trade_name', async () => {
    const res = await listClients({ search: 'Special Kirana' }, mockSupabaseInstance, firmId);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].names.trade_name).toBe('Special Kirana');
  });

  it('filters clients by search matching partial GSTIN', async () => {
    const res = await listClients({ search: 'FAKETEST1234' }, mockSupabaseInstance, firmId);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].gstin).toBe('27FAKETEST1234Z8');
  });

  it('filters clients by GST scheme', async () => {
    const compositionRes = await listClients({ scheme: 'composition' }, mockSupabaseInstance, firmId);
    expect(compositionRes.totalCount).toBe(5);
    expect(compositionRes.items.every((c) => c.scheme === 'composition')).toBe(true);

    const qrmpRes = await listClients({ scheme: 'qrmp' }, mockSupabaseInstance, firmId);
    expect(qrmpRes.totalCount).toBe(10);
    expect(qrmpRes.items.every((c) => c.scheme === 'qrmp')).toBe(true);
  });

  it('enforces 25 items per page pagination limit', async () => {
    // Page 1 should return 25 items out of 30 total
    const page1Res = await listClients({ page: 1 }, mockSupabaseInstance, firmId);
    expect(page1Res.currentPage).toBe(1);
    expect(page1Res.pageSize).toBe(25);
    expect(page1Res.totalCount).toBe(30);
    expect(page1Res.totalPages).toBe(2);
    expect(page1Res.items).toHaveLength(25);

    // Page 2 should return remaining 5 items
    const page2Res = await listClients({ page: 2 }, mockSupabaseInstance, firmId);
    expect(page2Res.currentPage).toBe(2);
    expect(page2Res.items).toHaveLength(5);
  });
});
