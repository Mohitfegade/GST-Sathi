/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prepareUploads,
  confirmUpload,
  discardUpload,
  deleteDocument,
} from '@/lib/uploads/actions';
import {
  listDocuments,
  getDocument,
  getDocumentStatusCounts,
} from '@/lib/uploads/queries';
import { cleanupStaleUploads } from '@/lib/uploads/cleanup';
import { STORAGE_BUCKET } from '@/lib/uploads/limits';
import type { SessionContext } from '@/lib/auth/types';
import type { PrepareUploadFile } from '@/lib/uploads/types';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks: Navigation & Cache
// ---------------------------------------------------------------------------
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

// Mock enqueueExtraction stub
vi.mock('@/lib/uploads/enqueue', () => ({
  enqueueExtraction: vi.fn(async (documentId: string) => ({
    queued: true,
    documentId,
  })),
}));

// ---------------------------------------------------------------------------
// In-Memory Simulated Database & Storage
// ---------------------------------------------------------------------------
interface SimulatedClient {
  id: string;
  firm_id: string;
  legal_name: string;
  deleted_at: string | null;
}

interface SimulatedDocument {
  id: string;
  firm_id: string;
  client_id: string;
  kind: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  status: 'uploaded' | 'queued' | 'processing' | 'needs_review' | 'done' | 'failed';
  uploaded_by: string | null;
  period_fp: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const firmAId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const firmBId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const clientAId = '11111111-1111-4111-a111-111111111111'; // belongs to Firm A
const clientBId = '22222222-2222-4222-a222-222222222222'; // belongs to Firm B

const userAccountantAId = 'usr-accountant-a';
const userOwnerAId = 'usr-owner-client-a';

let currentSession: SessionContext | null = null;
let clientsTable: SimulatedClient[] = [];
let documentsTable: SimulatedDocument[] = [];
const storageMap = new Map<string, { bytes: Uint8Array; mimeType: string }>();

function sha256Hex(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// ---------------------------------------------------------------------------
// Mock Supabase Factory
// ---------------------------------------------------------------------------
function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: currentSession?.user ?? null },
        error: currentSession ? null : new Error('Not authenticated'),
      })),
    },
    from: vi.fn((tableName: string) => {
      let filteredClients = [...clientsTable];
      let filteredDocs = [...documentsTable];

      const chain: any = {
        select: vi.fn((_cols?: string, options?: any) => {
          if (tableName === 'documents') {
            if (options?.count === 'exact') {
              return {
                ...chain,
                then: (resolve: any) =>
                  resolve({
                    data: filteredDocs,
                    count: filteredDocs.length,
                    error: null,
                  }),
              };
            }
          }
          return chain;
        }),
        eq: vi.fn((col: string, val: any) => {
          if (tableName === 'clients') {
            filteredClients = filteredClients.filter((c: any) => c[col] === val);
          } else if (tableName === 'documents') {
            filteredDocs = filteredDocs.filter((d: any) => d[col] === val);
          }
          return chain;
        }),
        is: vi.fn((col: string, val: any) => {
          if (tableName === 'clients') {
            filteredClients = filteredClients.filter((c: any) =>
              val === null ? c[col] === null : c[col] === val
            );
          } else if (tableName === 'documents') {
            filteredDocs = filteredDocs.filter((d: any) =>
              val === null ? d[col] === null : d[col] === val
            );
          }
          return chain;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          if (tableName === 'documents') {
            filteredDocs = filteredDocs.filter((d: any) => vals.includes(d[col]));
          }
          return chain;
        }),
        lt: vi.fn((col: string, val: any) => {
          if (tableName === 'documents') {
            filteredDocs = filteredDocs.filter((d: any) => {
              if (col === 'created_at') {
                return new Date(d.created_at).getTime() < new Date(val).getTime();
              }
              return d[col] < val;
            });
          }
          return chain;
        }),
        order: vi.fn((_col: string, _opts?: any) => chain),
        range: vi.fn((from: number, to: number) => {
          const slice = filteredDocs.slice(from, to + 1);
          return {
            ...chain,
            then: (resolve: any) =>
              resolve({
                data: slice,
                count: filteredDocs.length,
                error: null,
              }),
          };
        }),
        maybeSingle: vi.fn(async () => {
          if (tableName === 'clients') {
            return { data: filteredClients[0] ?? null, error: null };
          }
          if (tableName === 'documents') {
            return { data: filteredDocs[0] ?? null, error: null };
          }
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (tableName === 'documents') {
            resolve({ data: filteredDocs, error: null });
          } else {
            resolve({ data: filteredClients, error: null });
          }
        },
        insert: vi.fn(async (payload: any) => {
          if (tableName === 'documents') {
            const now = new Date().toISOString();
            const newDoc: SimulatedDocument = {
              id: payload.id || crypto.randomUUID(),
              firm_id: payload.firm_id,
              client_id: payload.client_id,
              kind: payload.kind || 'purchase_bill',
              storage_path: payload.storage_path,
              original_name: payload.original_name,
              mime_type: payload.mime_type,
              size_bytes: payload.size_bytes,
              sha256: payload.sha256,
              status: payload.status || 'uploaded',
              uploaded_by: payload.uploaded_by || null,
              period_fp: payload.period_fp || null,
              created_at: payload.created_at || now,
              updated_at: payload.updated_at || now,
              deleted_at: payload.deleted_at || null,
            };
            documentsTable.push(newDoc);
            return { error: null };
          }
          return { error: null };
        }),
        update: vi.fn((updates: any) => {
          const updateChain: any = {
            eq: vi.fn((col: string, val: any) => {
              for (const doc of documentsTable) {
                if ((doc as any)[col] === val) {
                  Object.assign(doc, updates);
                }
              }
              return updateChain;
            }),
            is: vi.fn((_col: string, _val: any) => updateChain),
            then: (resolve: any) => resolve({ data: null, error: null }),
          };
          return updateChain;
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((col: string, val: any) => {
            const idx = documentsTable.findIndex((d: any) => d[col] === val);
            if (idx !== -1) {
              documentsTable.splice(idx, 1);
            }
            return Promise.resolve({ error: null });
          }),
        })),
      };

      return chain;
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        createSignedUploadUrl: vi.fn(async (path: string) => ({
          data: {
            signedUrl: `https://storage.supabase.co/upload/sign/${bucket}/${path}`,
            token: `token-${crypto.randomUUID()}`,
          },
          error: null,
        })),
        createSignedUrl: vi.fn(async (path: string, expiresIn: number) => ({
          data: {
            signedUrl: `https://storage.supabase.co/object/sign/${bucket}/${path}?token=preview&expires=${expiresIn}`,
          },
          error: null,
        })),
        download: vi.fn(async (path: string) => {
          const obj = storageMap.get(path);
          if (!obj) {
            return { data: null, error: new Error('Object not found in storage') };
          }
          const blob = {
            size: obj.bytes.length,
            type: obj.mimeType,
            arrayBuffer: async () => obj.bytes.buffer.slice(
              obj.bytes.byteOffset,
              obj.bytes.byteOffset + obj.bytes.byteLength
            ),
          };
          return { data: blob as any, error: null };
        }),
        remove: vi.fn(async (paths: string[]) => {
          for (const p of paths) {
            storageMap.delete(p);
          }
          return { data: paths.map((p) => ({ name: p })), error: null };
        }),
      })),
    },
    rpc: vi.fn(async (funcName: string, args: any) => {
      if (funcName === 'check_upload_quota') {
        return { data: true, error: null };
      }
      if (funcName === 'confirm_document_upload') {
        const doc = documentsTable.find((d) => d.id === args.document_id_param);
        if (doc) {
          doc.status = 'queued';
          doc.updated_at = new Date().toISOString();
        }
        return {
          data: { ok: true, id: args.document_id_param, status: 'queued' },
          error: null,
        };
      }
      if (funcName === 'fail_document_upload') {
        const doc = documentsTable.find((d) => d.id === args.document_id_param);
        if (doc) {
          doc.status = 'failed';
          doc.updated_at = new Date().toISOString();
        }
        return {
          data: { ok: true, id: args.document_id_param, status: 'failed' },
          error: null,
        };
      }
      return { data: null, error: null };
    }),
  };
}

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => mockSupabase),
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(async () => {
    if (!currentSession) {
      mockRedirect('/login');
    }
    return currentSession!;
  }),
}));

vi.mock('@/lib/auth/roles', () => ({
  requireFirmRole: vi.fn(async (minRole: string) => {
    if (!currentSession?.firm) {
      mockRedirect('/no-access');
      throw new Error('No access');
    }
    return currentSession.firm;
  }),
  requireClientAccess: vi.fn(async (clientId: string) => {
    if (!currentSession) {
      mockRedirect('/login');
      throw new Error('Not logged in');
    }
    const client = currentSession.clients?.find((c) => c.id === clientId);
    if (!client) {
      mockRedirect('/no-access');
      throw new Error('No access');
    }
    return client;
  }),
}));

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('Access Isolation & Security Integration Tests (src/tests/uploads/access-isolation.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();

    clientsTable = [
      { id: clientAId, firm_id: firmAId, legal_name: 'Firm A Retailer', deleted_at: null },
      { id: clientBId, firm_id: firmBId, legal_name: 'Firm B Wholesaler', deleted_at: null },
    ];
    documentsTable = [];
    storageMap.clear();

    // Default: Firm A staff member
    currentSession = {
      user: { id: userAccountantAId, email: 'staff@firma.in' } as any,
      firm: { id: firmAId, name: 'Firm A Consultants', role: 'staff' },
      clients: [],
      home: '/app',
    };
  });

  describe('1. Cross-Firm Isolation for Accountants', () => {
    it('denies prepareUploads when accountant tries to prepare uploads for another firm client', async () => {
      // User is logged into Firm A, but target clientId is clientBId (belongs to Firm B)
      const res = await prepareUploads(clientBId, [
        {
          originalName: 'trespassing_bill.jpg',
          sizeBytes: 150000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('cross-firm-bill-1'),
        },
      ]);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('You do not have access to this client.');
      }
      expect(documentsTable).toHaveLength(0);
    });

    it('denies confirmUpload when accountant tries to confirm upload for another firm document', async () => {
      // Create a document belonging to Firm B / Client B in the DB
      const docBId = crypto.randomUUID();
      const storagePathB = `${firmBId}/${clientBId}/${docBId}`;
      documentsTable.push({
        id: docBId,
        firm_id: firmBId,
        client_id: clientBId,
        kind: 'purchase_bill',
        storage_path: storagePathB,
        original_name: 'firm_b_bill.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 200000,
        sha256: sha256Hex('firm-b-doc'),
        status: 'uploaded',
        uploaded_by: 'some-other-user',
        period_fp: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });

      storageMap.set(storagePathB, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });

      // User is staff of Firm A; attempts to confirm docBId
      const res = await confirmUpload(docBId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('You do not have access to this document.');
      }

      // Status should remain 'uploaded', NOT transitioned to 'queued'
      const docInDb = documentsTable.find((d) => d.id === docBId);
      expect(docInDb?.status).toBe('uploaded');
    });

    it('denies discardUpload and deleteDocument when accountant targets another firm document', async () => {
      const docBId = crypto.randomUUID();
      documentsTable.push({
        id: docBId,
        firm_id: firmBId,
        client_id: clientBId,
        kind: 'purchase_bill',
        storage_path: `${firmBId}/${clientBId}/${docBId}`,
        original_name: 'firm_b_secret.pdf',
        mime_type: 'application/pdf',
        size_bytes: 300000,
        sha256: sha256Hex('firm-b-secret'),
        status: 'uploaded',
        uploaded_by: 'firm-b-user',
        period_fp: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });

      // Attempt discard
      const discardRes = await discardUpload(docBId);
      expect(discardRes.ok).toBe(false);
      if (!discardRes.ok) {
        expect(discardRes.message).toBe('You do not have access to this document.');
      }

      // Attempt delete
      const deleteRes = await deleteDocument(docBId);
      expect(deleteRes.ok).toBe(false);
      if (!deleteRes.ok) {
        expect(deleteRes.message).toBe('You do not have permission to delete this bill.');
      }

      // Ensure document was NOT deleted
      const docInDb = documentsTable.find((d) => d.id === docBId);
      expect(docInDb?.deleted_at).toBeNull();
    });
  });

  describe('2. Cross-Client Isolation for Shop Owners', () => {
    it('denies prepareUploads when shop owner targets a client they do not own', async () => {
      // User is owner of Client A ONLY
      currentSession = {
        user: { id: userOwnerAId, email: 'owner@shopa.in' } as any,
        firm: null,
        clients: [{ id: clientAId, name: 'Shop A', role: 'owner' }],
        home: '/portal',
      };

      // Attempting to upload to clientBId triggers requireClientAccess check failure
      await expect(
        prepareUploads(clientBId, [
          {
            originalName: 'intruder_bill.jpg',
            sizeBytes: 100000,
            mimeType: 'image/jpeg',
            sha256: sha256Hex('intruder-bill'),
          },
        ])
      ).rejects.toThrow('NEXT_REDIRECT: /no-access');

      expect(documentsTable).toHaveLength(0);
    });

    it('denies confirmUpload when shop owner targets a document belonging to another client', async () => {
      // Create document belonging to Client B
      const docBId = crypto.randomUUID();
      documentsTable.push({
        id: docBId,
        firm_id: firmBId,
        client_id: clientBId,
        kind: 'purchase_bill',
        storage_path: `${firmBId}/${clientBId}/${docBId}`,
        original_name: 'doc_b.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 100000,
        sha256: sha256Hex('doc-b-hash'),
        status: 'uploaded',
        uploaded_by: 'someone-else',
        period_fp: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });

      // User is owner of Client A
      currentSession = {
        user: { id: userOwnerAId, email: 'owner@shopa.in' } as any,
        firm: null,
        clients: [{ id: clientAId, name: 'Shop A', role: 'owner' }],
        home: '/portal',
      };

      const res = await confirmUpload(docBId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('You do not have access to this document.');
      }
    });
  });

  describe('3. Soft Delete Isolation in listDocuments and Queries', () => {
    it('excludes soft-deleted documents from listDocuments and getDocumentStatusCounts', async () => {
      const now = new Date();
      const doc1Id = crypto.randomUUID();
      const doc2Id = crypto.randomUUID();
      const doc3Id = crypto.randomUUID();

      // Insert 3 documents for Client A: 2 active, 1 soft-deleted
      documentsTable = [
        {
          id: doc1Id,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: `${firmAId}/${clientAId}/${doc1Id}`,
          original_name: 'active_bill_1.pdf',
          mime_type: 'application/pdf',
          size_bytes: 100000,
          sha256: sha256Hex('doc1'),
          status: 'queued',
          uploaded_by: userAccountantAId,
          period_fp: '102026',
          created_at: new Date(now.getTime() - 10000).toISOString(),
          updated_at: now.toISOString(),
          deleted_at: null,
        },
        {
          id: doc2Id,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: `${firmAId}/${clientAId}/${doc2Id}`,
          original_name: 'deleted_bill_2.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 200000,
          sha256: sha256Hex('doc2'),
          status: 'uploaded',
          uploaded_by: userAccountantAId,
          period_fp: '102026',
          created_at: new Date(now.getTime() - 20000).toISOString(),
          updated_at: now.toISOString(),
          deleted_at: new Date(now.getTime() - 5000).toISOString(), // SOFT-DELETED
        },
        {
          id: doc3Id,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: `${firmAId}/${clientAId}/${doc3Id}`,
          original_name: 'active_bill_3.png',
          mime_type: 'image/png',
          size_bytes: 150000,
          sha256: sha256Hex('doc3'),
          status: 'done',
          uploaded_by: userAccountantAId,
          period_fp: '102026',
          created_at: new Date(now.getTime() - 30000).toISOString(),
          updated_at: now.toISOString(),
          deleted_at: null,
        },
      ];

      // 1. listDocuments: soft-deleted doc2 must NOT appear
      const list = await listDocuments(clientAId, {}, mockSupabase as any);
      expect(list.total).toBe(2);
      expect(list.items).toHaveLength(2);
      expect(list.items.map((i) => i.id)).toEqual(expect.arrayContaining([doc1Id, doc3Id]));
      expect(list.items.some((i) => i.id === doc2Id)).toBe(false);

      // 2. getDocument: soft-deleted doc2 returns null
      const singleActive = await getDocument(doc1Id, mockSupabase as any);
      expect(singleActive).not.toBeNull();
      expect(singleActive?.id).toBe(doc1Id);

      const singleDeleted = await getDocument(doc2Id, mockSupabase as any);
      expect(singleDeleted).toBeNull();

      // 3. getDocumentStatusCounts: does not include doc2
      const counts = await getDocumentStatusCounts(clientAId, mockSupabase as any);
      expect(counts.total).toBe(2);
      expect(counts.uploaded).toBe(0); // doc2 was 'uploaded' but is deleted
      expect(counts.queued).toBe(1); // doc1
      expect(counts.done).toBe(1); // doc3
    });
  });

  describe('4. Stale Uploads Cleanup (cleanupStaleUploads)', () => {
    it('cleans up unconfirmed uploaded rows older than 1 hour, deletes storage objects, and preserves recent or queued bills', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();
      const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();

      const staleDocId = crypto.randomUUID();
      const recentDocId = crypto.randomUUID();
      const queuedDocId = crypto.randomUUID();
      const clientBOldDocId = crypto.randomUUID();

      const stalePath = `${firmAId}/${clientAId}/${staleDocId}`;
      const recentPath = `${firmAId}/${clientAId}/${recentDocId}`;
      const queuedPath = `${firmAId}/${clientAId}/${queuedDocId}`;
      const clientBPath = `${firmBId}/${clientBId}/${clientBOldDocId}`;

      // Populate documentsTable
      documentsTable = [
        // 1. Stale unconfirmed upload for Client A (created 2 hrs ago) -> SHOULD BE CLEANED
        {
          id: staleDocId,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: stalePath,
          original_name: 'abandoned_bill.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 200000,
          sha256: sha256Hex('stale-1'),
          status: 'uploaded',
          uploaded_by: userAccountantAId,
          period_fp: null,
          created_at: twoHoursAgo,
          updated_at: twoHoursAgo,
          deleted_at: null,
        },
        // 2. Recent unconfirmed upload for Client A (created 15 mins ago) -> MUST BE PRESERVED
        {
          id: recentDocId,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: recentPath,
          original_name: 'in_progress_bill.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 150000,
          sha256: sha256Hex('recent-1'),
          status: 'uploaded',
          uploaded_by: userAccountantAId,
          period_fp: null,
          created_at: fifteenMinsAgo,
          updated_at: fifteenMinsAgo,
          deleted_at: null,
        },
        // 3. Confirmed bill for Client A (status = 'queued', 2 hrs old) -> MUST BE PRESERVED
        {
          id: queuedDocId,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: queuedPath,
          original_name: 'queued_bill.pdf',
          mime_type: 'application/pdf',
          size_bytes: 300000,
          sha256: sha256Hex('queued-1'),
          status: 'queued',
          uploaded_by: userAccountantAId,
          period_fp: null,
          created_at: twoHoursAgo,
          updated_at: twoHoursAgo,
          deleted_at: null,
        },
        // 4. Stale upload for Client B (3 hrs old)
        {
          id: clientBOldDocId,
          firm_id: firmBId,
          client_id: clientBId,
          kind: 'purchase_bill',
          storage_path: clientBPath,
          original_name: 'client_b_abandoned.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 180000,
          sha256: sha256Hex('client-b-stale'),
          status: 'uploaded',
          uploaded_by: 'client-b-user',
          period_fp: null,
          created_at: threeHoursAgo,
          updated_at: threeHoursAgo,
          deleted_at: null,
        },
      ];

      // Populate mock storage objects
      storageMap.set(stalePath, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });
      storageMap.set(recentPath, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });
      storageMap.set(queuedPath, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });
      storageMap.set(clientBPath, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });

      // Run cleanup targeting Client A only
      const cleanupResult = await cleanupStaleUploads({
        clientId: clientAId,
        maxAgeHours: 1,
        supabaseClient: mockSupabase as any,
      });

      expect(cleanupResult.totalCleaned).toBe(1);
      expect(cleanupResult.storageObjectsRemoved).toBe(1);
      expect(cleanupResult.errors).toHaveLength(0);

      // Verify Stale Doc 1 was soft deleted and storage object was removed
      const docStale = documentsTable.find((d) => d.id === staleDocId);
      expect(docStale?.deleted_at).not.toBeNull();
      expect(storageMap.has(stalePath)).toBe(false);

      // Verify Recent Doc 2 was NOT deleted and storage object remains
      const docRecent = documentsTable.find((d) => d.id === recentDocId);
      expect(docRecent?.deleted_at).toBeNull();
      expect(storageMap.has(recentPath)).toBe(true);

      // Verify Queued Doc 3 was NOT deleted
      const docQueued = documentsTable.find((d) => d.id === queuedDocId);
      expect(docQueued?.deleted_at).toBeNull();
      expect(storageMap.has(queuedPath)).toBe(true);

      // Verify Client B Doc was untouched because clientId filter was Client A
      const docClientB = documentsTable.find((d) => d.id === clientBOldDocId);
      expect(docClientB?.deleted_at).toBeNull();
      expect(storageMap.has(clientBPath)).toBe(true);

      // Subsequent listDocuments for Client A only shows active documents (recent and queued)
      const listA = await listDocuments(clientAId, {}, mockSupabase as any);
      expect(listA.items.some((d) => d.id === staleDocId)).toBe(false);
      expect(listA.items.some((d) => d.id === recentDocId)).toBe(true);
      expect(listA.items.some((d) => d.id === queuedDocId)).toBe(true);
    });

    it('cleans up across all clients when clientId is omitted', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

      const docAId = crypto.randomUUID();
      const docBId = crypto.randomUUID();
      const pathA = `${firmAId}/${clientAId}/${docAId}`;
      const pathB = `${firmBId}/${clientBId}/${docBId}`;

      documentsTable = [
        {
          id: docAId,
          firm_id: firmAId,
          client_id: clientAId,
          kind: 'purchase_bill',
          storage_path: pathA,
          original_name: 'stale_a.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 100000,
          sha256: sha256Hex('stale-a'),
          status: 'uploaded',
          uploaded_by: userAccountantAId,
          period_fp: null,
          created_at: twoHoursAgo,
          updated_at: twoHoursAgo,
          deleted_at: null,
        },
        {
          id: docBId,
          firm_id: firmBId,
          client_id: clientBId,
          kind: 'purchase_bill',
          storage_path: pathB,
          original_name: 'stale_b.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 100000,
          sha256: sha256Hex('stale-b'),
          status: 'uploaded',
          uploaded_by: 'user-b',
          period_fp: null,
          created_at: twoHoursAgo,
          updated_at: twoHoursAgo,
          deleted_at: null,
        },
      ];

      storageMap.set(pathA, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });
      storageMap.set(pathB, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });

      // Run cleanup without clientId filter
      const res = await cleanupStaleUploads({
        supabaseClient: mockSupabase as any,
      });

      expect(res.totalCleaned).toBe(2);
      expect(res.storageObjectsRemoved).toBe(2);
      expect(documentsTable.every((d) => d.deleted_at !== null)).toBe(true);
      expect(storageMap.size).toBe(0);
    });
  });
});
