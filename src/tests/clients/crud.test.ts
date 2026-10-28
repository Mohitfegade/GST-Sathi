/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createClient,
  updateClient,
  archiveClient,
  restoreClient,
} from '../../lib/clients/actions';
import { CLIENT_MESSAGES } from '../../lib/clients/messages';
import { generateFakeGstin } from '../../lib/gst/gstin';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Mock Next.js revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock Next.js navigation redirect
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
                    firms: { id: store.firmId, name: 'Apex Tax Consultants', deleted_at: null },
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
        let selectedRows = [...store.clients];

        const chain: Record<string, any> = {
          select: vi.fn((_cols?: string) => chain),
          eq: vi.fn((col: string, val: unknown) => {
            selectedRows = selectedRows.filter((r: any) => r[col] === val);
            return chain;
          }),
          neq: vi.fn((col: string, val: unknown) => {
            selectedRows = selectedRows.filter((r: any) => r[col] !== val);
            return chain;
          }),
          is: vi.fn((col: string, val: unknown) => {
            if (val === null) {
              selectedRows = selectedRows.filter((r: any) => r[col] === null);
            }
            return chain;
          }),
          maybeSingle: vi.fn(async () => ({
            data: selectedRows[0] ?? null,
            error: null,
          })),
          single: vi.fn(async () => ({
            data: selectedRows[0] ?? null,
            error: selectedRows[0] ? null : new Error('Row not found'),
          })),
          insert: vi.fn((payload: any) => {
            // Check for partial unique index violation on active GSTIN: (firm_id, gstin) where deleted_at is null
            const isDuplicate = store.clients.some(
              (c) =>
                c.firm_id === payload.firm_id &&
                c.gstin === payload.gstin &&
                c.deleted_at === null
            );

            if (isDuplicate) {
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      code: '23505',
                      message: 'duplicate key value violates unique constraint "uq_clients_firm_gstin_active"',
                      details: 'Key (firm_id, gstin)=(...) already exists.',
                    },
                  }),
                }),
              };
            }

            const newId = `c-${crypto.randomUUID()}`;
            const newRow: SimulatedClientRow = {
              id: newId,
              firm_id: payload.firm_id,
              legal_name: payload.legal_name,
              trade_name: payload.trade_name ?? null,
              gstin: payload.gstin,
              state_code: payload.state_code,
              scheme: payload.scheme ?? 'regular',
              aato_band: payload.aato_band ?? 'below_40l',
              fy_start_month: payload.fy_start_month ?? 4,
              language: payload.language ?? 'en',
              sells_exempt: payload.sells_exempt ?? false,
              sells_taxable: payload.sells_taxable ?? true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            };
            store.clients.push(newRow);

            return {
              select: () => ({
                single: async () => ({
                  data: { id: newId },
                  error: null,
                }),
              }),
            };
          }),
          update: vi.fn((updates: any) => {
            const filterCols: Array<{ col: string; val: any; isNull?: boolean }> = [];
            const executeUpdate = () => {
              const targets = store.clients.filter((c: any) =>
                filterCols.every((f) => (f.isNull ? c[f.col] === null : c[f.col] === f.val))
              );
              for (const target of targets) {
                Object.assign(target, updates, {
                  updated_at: new Date().toISOString(),
                });
              }
              return { data: targets.length > 0 ? { id: targets[0].id } : null, error: null };
            };

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
                maybeSingle: async () => executeUpdate(),
                single: async () => executeUpdate(),
              })),
              then: (resolve: any, reject: any) => {
                try {
                  const res = executeUpdate();
                  resolve(res);
                } catch (e) {
                  if (reject) reject(e);
                  else throw e;
                }
              },
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

let mockStore: MockStore;
let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Client CRUD Integration Tests (src/tests/clients/crud.test.ts)', () => {
  const firmId = '11111111-1111-4111-8111-111111111111';
  const adminUser: User = { id: 'usr-admin-1', email: 'admin@apextax.in' } as User;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      currentUser: adminUser,
      firmId,
      firmRole: 'admin',
      clients: [],
    };

    mockSupabase = createMockSupabase(mockStore);
  });

  describe('1. Client Creation', () => {
    it('creates a new client successfully with valid payload and derives state code from GSTIN', async () => {
      // Algorithmic valid Maharashtra GSTIN (state code 27)
      const validGstin = generateFakeGstin('27');

      const payload = {
        legal_name: 'FAKE - Sharma Supermarket Private Limited',
        trade_name: 'FAKE - Sharma Supermarket',
        gstin: validGstin,
        scheme: 'regular',
        aato_band: '40l_to_1_5cr',
        sells_exempt: true,
        sells_taxable: true,
        language: 'mr',
      };

      const result = await createClient(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBeDefined();

        // Check stored client in mock db
        const stored = mockStore.clients.find((c) => c.id === result.data.id);
        expect(stored).toBeDefined();
        expect(stored?.legal_name).toBe('FAKE - Sharma Supermarket Private Limited');
        expect(stored?.trade_name).toBe('FAKE - Sharma Supermarket');
        expect(stored?.gstin).toBe(validGstin);
        expect(stored?.state_code).toBe('27');
        expect(stored?.scheme).toBe('regular');
        expect(stored?.aato_band).toBe('40l_to_1_5cr');
        expect(stored?.sells_exempt).toBe(true);
        expect(stored?.sells_taxable).toBe(true);
        expect(stored?.language).toBe('mr');
        expect(stored?.deleted_at).toBeNull();
      }
    });

    it('creates a client successfully using FormData input', async () => {
      const validGstin = generateFakeGstin('24'); // Gujarat

      const formData = new FormData();
      formData.append('legal_name', 'FAKE - Patel Provisions LLP');
      formData.append('trade_name', 'FAKE - Patel Kirana');
      formData.append('gstin', validGstin);
      formData.append('scheme', 'qrmp');
      formData.append('aato_band', 'below_40l');
      formData.append('sells_exempt', 'true');
      formData.append('sells_taxable', 'true');
      formData.append('language', 'hi');

      const result = await createClient(formData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const stored = mockStore.clients.find((c) => c.id === result.data.id);
        expect(stored).toBeDefined();
        expect(stored?.state_code).toBe('24');
        expect(stored?.scheme).toBe('qrmp');
        expect(stored?.trade_name).toBe('FAKE - Patel Kirana');
      }
    });

    it('rejects client creation when legal name is missing or whitespace only', async () => {
      const validGstin = generateFakeGstin('27');

      const result = await createClient({
        legal_name: '   ',
        gstin: validGstin,
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.nameRequired,
        field: 'legal_name',
      });
      expect(mockStore.clients.length).toBe(0);
    });

    it('rejects client creation when GSTIN is missing or empty', async () => {
      const result = await createClient({
        legal_name: 'FAKE - Ganesh Stationery Store',
        gstin: '',
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.gstinRequired,
        field: 'gstin',
      });
      expect(mockStore.clients.length).toBe(0);
    });

    it('rejects client creation when GSTIN checksum is invalid', async () => {
      const validGstin = generateFakeGstin('27');
      // Intentionally tamper with the 15th character (checksum)
      const lastChar = validGstin.slice(-1);
      const tamperedChecksum = lastChar === 'Z' ? 'A' : 'Z';
      const invalidGstin = `${validGstin.slice(0, 14)}${tamperedChecksum}`;

      const result = await createClient({
        legal_name: 'FAKE - Chemist Pharmacy Store',
        gstin: invalidGstin,
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.gstinChecksumFailed,
        field: 'gstin',
      });
      expect(mockStore.clients.length).toBe(0);
    });

    it('rejects client creation when both sells_exempt and sells_taxable are false', async () => {
      const validGstin = generateFakeGstin('27');

      const result = await createClient({
        legal_name: 'FAKE - Invalid Supply Shop',
        gstin: validGstin,
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_exempt: false,
        sells_taxable: false,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.sellingTypeRequired,
        field: 'sells_taxable',
      });
      expect(mockStore.clients.length).toBe(0);
    });
  });

  describe('2. Duplicate GSTIN Detection', () => {
    it('rejects client creation with duplicate active GSTIN in the same firm', async () => {
      const sharedGstin = generateFakeGstin('27');

      // Seed an existing active client with sharedGstin
      mockStore.clients.push({
        id: 'client-existing-1',
        firm_id: firmId,
        legal_name: 'FAKE - Existing Hardware Mart',
        trade_name: 'FAKE - Existing Hardware',
        gstin: sharedGstin,
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
      });

      // Attempt to create second client with the same active GSTIN
      const result = await createClient({
        legal_name: 'FAKE - Duplicate Retail Store',
        gstin: sharedGstin,
        scheme: 'composition',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
        field: 'gstin',
      });
      expect(mockStore.clients.length).toBe(1);
    });

    it('permits creating a client with the same GSTIN as a soft-deleted (archived) client', async () => {
      const reusableGstin = generateFakeGstin('27');

      // Seed an archived client with reusableGstin
      mockStore.clients.push({
        id: 'client-archived-1',
        firm_id: firmId,
        legal_name: 'FAKE - Old Closed Firm Client',
        trade_name: null,
        gstin: reusableGstin,
        state_code: '27',
        scheme: 'regular',
        aato_band: 'below_40l',
        fy_start_month: 4,
        language: 'en',
        sells_exempt: false,
        sells_taxable: true,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(), // ARCHIVED
      });

      // Registering new active client with the same GSTIN succeeds per partial index uq_clients_firm_gstin_active
      const result = await createClient({
        legal_name: 'FAKE - Re-registered Business New Owner',
        gstin: reusableGstin,
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result.ok).toBe(true);
      expect(mockStore.clients.length).toBe(2);
    });
  });

  describe('3. Updating Client Fields', () => {
    it('updates client fields successfully', async () => {
      const initialGstin = generateFakeGstin('27');
      const clientId = 'c-update-test-1';

      mockStore.clients.push({
        id: clientId,
        firm_id: firmId,
        legal_name: 'FAKE - Original Shop Name',
        trade_name: 'FAKE - Old Trade Name',
        gstin: initialGstin,
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
      });

      const updatedGstin = generateFakeGstin('29'); // Karnataka

      const updateResult = await updateClient(clientId, {
        legal_name: 'FAKE - Updated Enterprise Name',
        trade_name: 'FAKE - Modern Shop',
        gstin: updatedGstin,
        scheme: 'composition',
        aato_band: '40l_to_1_5cr',
        sells_exempt: true,
        sells_taxable: true,
        language: 'mr',
      });

      expect(updateResult).toEqual({
        ok: true,
        data: { id: clientId },
      });

      const updated = mockStore.clients.find((c) => c.id === clientId);
      expect(updated?.legal_name).toBe('FAKE - Updated Enterprise Name');
      expect(updated?.trade_name).toBe('FAKE - Modern Shop');
      expect(updated?.gstin).toBe(updatedGstin);
      expect(updated?.state_code).toBe('29');
      expect(updated?.scheme).toBe('composition');
      expect(updated?.aato_band).toBe('40l_to_1_5cr');
      expect(updated?.language).toBe('mr');
    });

    it('rejects update if new GSTIN conflicts with another active client in the firm', async () => {
      const gstin1 = generateFakeGstin('27');
      const gstin2 = generateFakeGstin('27');

      const client1Id = 'client-1-uuid';
      const client2Id = 'client-2-uuid';

      mockStore.clients.push(
        {
          id: client1Id,
          firm_id: firmId,
          legal_name: 'FAKE - Client One Ltd',
          trade_name: null,
          gstin: gstin1,
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
          id: client2Id,
          firm_id: firmId,
          legal_name: 'FAKE - Client Two Ltd',
          trade_name: null,
          gstin: gstin2,
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
        }
      );

      // Attempt to change Client 2's GSTIN to Client 1's GSTIN
      const result = await updateClient(client2Id, {
        legal_name: 'FAKE - Client Two Ltd',
        gstin: gstin1, // conflict!
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
        field: 'gstin',
      });
    });

    it('returns clientNotFound error when updating a non-existent client', async () => {
      const validGstin = generateFakeGstin('27');
      const result = await updateClient('non-existent-id', {
        legal_name: 'FAKE - Phantom Business',
        gstin: validGstin,
        scheme: 'regular',
        aato_band: 'below_40l',
        sells_taxable: true,
      });

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.clientNotFound,
      });
    });
  });

  describe('4. Archiving (Soft-Delete) and Restoring Clients', () => {
    it('archives an active client by populating deleted_at', async () => {
      const clientId = 'c-archive-test-1';
      const gstin = generateFakeGstin('27');

      mockStore.clients.push({
        id: clientId,
        firm_id: firmId,
        legal_name: 'FAKE - Client to Archive',
        trade_name: null,
        gstin,
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
      });

      const result = await archiveClient(clientId);

      expect(result).toEqual({
        ok: true,
        data: undefined,
      });

      const archived = mockStore.clients.find((c) => c.id === clientId);
      expect(archived?.deleted_at).not.toBeNull();
      expect(typeof archived?.deleted_at).toBe('string');
    });

    it('restores an archived client by clearing deleted_at', async () => {
      const clientId = 'c-restore-test-1';
      const gstin = generateFakeGstin('27');

      mockStore.clients.push({
        id: clientId,
        firm_id: firmId,
        legal_name: 'FAKE - Client to Restore',
        trade_name: null,
        gstin,
        state_code: '27',
        scheme: 'regular',
        aato_band: 'below_40l',
        fy_start_month: 4,
        language: 'en',
        sells_exempt: false,
        sells_taxable: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(), // currently archived
      });

      const result = await restoreClient(clientId);

      expect(result).toEqual({
        ok: true,
        data: undefined,
      });

      const restored = mockStore.clients.find((c) => c.id === clientId);
      expect(restored?.deleted_at).toBeNull();
    });

    it('prevents restoring an archived client if its GSTIN is currently active on another client', async () => {
      const sharedGstin = generateFakeGstin('27');
      const archivedClientId = 'c-archived-dup';
      const activeClientId = 'c-active-dup';

      mockStore.clients.push(
        {
          id: archivedClientId,
          firm_id: firmId,
          legal_name: 'FAKE - Archived Client',
          trade_name: null,
          gstin: sharedGstin,
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: new Date().toISOString(), // archived
        },
        {
          id: activeClientId,
          firm_id: firmId,
          legal_name: 'FAKE - Newly Registered Active Client with same GSTIN',
          trade_name: null,
          gstin: sharedGstin,
          state_code: '27',
          scheme: 'regular',
          aato_band: 'below_40l',
          fy_start_month: 4,
          language: 'en',
          sells_exempt: false,
          sells_taxable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null, // active
        }
      );

      const result = await restoreClient(archivedClientId);

      expect(result).toEqual({
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
      });

      // Verify the archived client remains archived
      const client = mockStore.clients.find((c) => c.id === archivedClientId);
      expect(client?.deleted_at).not.toBeNull();
    });
  });
});
