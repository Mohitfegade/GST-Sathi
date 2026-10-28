/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prepareUploads,
  confirmUpload,
  discardUpload,
  deleteDocument,
} from '@/lib/uploads/actions';
import { listDocuments, getDocument } from '@/lib/uploads/queries';
import { isValidUuid, parseDocumentStoragePath } from '@/lib/uploads/paths';
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
const mockEnqueueExtraction = vi.fn(async (documentId: string) => ({
  queued: true,
  documentId,
}));

vi.mock('@/lib/uploads/enqueue', () => ({
  enqueueExtraction: (documentId: string) => mockEnqueueExtraction(documentId),
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

const firmAId = '11111111-1111-4111-a111-111111111111';
const clientAId = '22222222-2222-4222-a222-222222222222';
const userAccountantId = '33333333-3333-4333-a333-333333333333';
const userOwnerId = '44444444-4444-4444-a444-444444444444';

let currentSession: SessionContext | null = null;
let clientsTable: SimulatedClient[] = [];
let documentsTable: SimulatedDocument[] = [];
const storageMap = new Map<string, { bytes: Uint8Array; mimeType: string }>();

// Helper to compute sha256
function sha256Hex(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Magic bytes for test uploads
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
const PDF_HEADER = Buffer.from('%PDF-1.4 test invoice content');
const WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x24, 0x00, 0x00, 0x00, // length
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x20, // VP8_
]);

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
              const activeDocs = filteredDocs.filter((d) => d.deleted_at === null);
              return {
                ...chain,
                then: (resolve: any) =>
                  resolve({
                    data: activeDocs,
                    count: activeDocs.length,
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
        neq: vi.fn((col: string, val: any) => {
          if (tableName === 'documents') {
            filteredDocs = filteredDocs.filter((d: any) => d[col] !== val);
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
        order: vi.fn(() => chain),
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
        single: vi.fn(async () => {
          if (tableName === 'clients') {
            return {
              data: filteredClients[0] ?? null,
              error: filteredClients[0] ? null : new Error('Not found'),
            };
          }
          if (tableName === 'documents') {
            return {
              data: filteredDocs[0] ?? null,
              error: filteredDocs[0] ? null : new Error('Not found'),
            };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn(async (payload: any) => {
          if (tableName === 'documents') {
            // Check unique constraint: (client_id, sha256) where deleted_at is null
            const isDuplicate = documentsTable.some(
              (d) =>
                d.client_id === payload.client_id &&
                d.sha256 === payload.sha256 &&
                d.deleted_at === null
            );
            if (isDuplicate) {
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "uq_documents_client_sha256_active"',
                },
              };
            }

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
              created_at: now,
              updated_at: now,
              deleted_at: null,
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
                  Object.assign(doc, updates, { updated_at: new Date().toISOString() });
                }
              }
              return updateChain;
            }),
            is: vi.fn((col: string, val: any) => {
              return updateChain;
            }),
            then: (resolve: any) => resolve({ data: null, error: null }),
          };
          return updateChain;
        }),
        delete: vi.fn(() => {
          const deleteChain: any = {
            eq: vi.fn((col: string, val: any) => {
              const idx = documentsTable.findIndex((d: any) => d[col] === val);
              if (idx !== -1) {
                documentsTable.splice(idx, 1);
              }
              return deleteChain;
            }),
            then: (resolve: any) => resolve({ data: null, error: null }),
          };
          return deleteChain;
        }),
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
          // Return a mock Blob with arrayBuffer method
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
          data: {
            ok: true,
            id: args.document_id_param,
            status: 'failed',
            reason: args.reason || '',
          },
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
    const roles = ['staff', 'admin'];
    const userRole = currentSession.firm.role;
    if (roles.indexOf(userRole) < roles.indexOf(minRole)) {
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
describe('Upload Flow Integration Tests (src/tests/uploads/upload-flow.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();

    // Reset database & storage tables
    clientsTable = [
      {
        id: clientAId,
        firm_id: firmAId,
        legal_name: 'Shree Ganesh Traders',
        deleted_at: null,
      },
    ];
    documentsTable = [];
    storageMap.clear();

    // Default session: firm staff
    currentSession = {
      user: { id: userAccountantId, email: 'ca@apex.in' } as any,
      firm: { id: firmAId, name: 'Apex Tax Consultants', role: 'staff' },
      clients: [],
      home: '/app',
    };
  });

  describe('1. prepareUploads -> Signed URL Generation & Path Structure', () => {
    it('successfully prepares a single bill with valid signed URL and canonical storage path', async () => {
      const fileData: PrepareUploadFile = {
        originalName: 'invoice_oct_2026.jpg',
        sizeBytes: 1024 * 500, // 500 KB
        mimeType: 'image/jpeg',
        sha256: sha256Hex('test-bill-october-content'),
        periodFp: '102026',
      };

      const result = await prepareUploads(clientAId, [fileData]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.duplicates).toHaveLength(0);
      expect(result.data.rejected).toHaveLength(0);
      expect(result.data.prepared).toHaveLength(1);

      const prep = result.data.prepared[0];
      expect(prep.originalName).toBe('invoice_oct_2026.jpg');
      expect(isValidUuid(prep.documentId)).toBe(true);
      expect(prep.signedUploadUrl).toContain('https://storage.supabase.co/upload/sign/documents/');
      expect(prep.token).toBeDefined();

      // Verify canonical storage path: {firm_id}/{client_id}/{document_id}
      expect(prep.storagePath).toBe(`${firmAId}/${clientAId}/${prep.documentId}`);

      const parsed = parseDocumentStoragePath(prep.storagePath);
      expect(parsed).not.toBeNull();
      expect(parsed?.firmId).toBe(firmAId);
      expect(parsed?.clientId).toBe(clientAId);
      expect(parsed?.documentId).toBe(prep.documentId);

      // Verify row inserted in DB with status 'uploaded'
      const docInDb = documentsTable.find((d) => d.id === prep.documentId);
      expect(docInDb).toBeDefined();
      expect(docInDb?.status).toBe('uploaded');
      expect(docInDb?.period_fp).toBe('102026');
      expect(docInDb?.uploaded_by).toBe(userAccountantId);
      expect(docInDb?.deleted_at).toBeNull();
    });

    it('prepares batch of multiple files (JPEG, PNG, PDF) with individual signed upload URLs', async () => {
      const batchFiles: PrepareUploadFile[] = [
        {
          originalName: 'bill_1.png',
          sizeBytes: 300 * 1024,
          mimeType: 'image/png',
          sha256: sha256Hex('bill-1-bytes'),
          periodFp: '102026',
        },
        {
          originalName: 'tax_invoice.pdf',
          sizeBytes: 1.2 * 1024 * 1024,
          mimeType: 'application/pdf',
          sha256: sha256Hex('bill-2-pdf-bytes'),
          periodFp: '102026',
        },
        {
          originalName: 'store_receipt.webp',
          sizeBytes: 150 * 1024,
          mimeType: 'image/webp',
          sha256: sha256Hex('bill-3-webp-bytes'),
        },
      ];

      const res = await prepareUploads(clientAId, batchFiles);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.prepared).toHaveLength(3);
      expect(res.data.duplicates).toHaveLength(0);
      expect(res.data.rejected).toHaveLength(0);

      for (let i = 0; i < batchFiles.length; i++) {
        const item = res.data.prepared[i];
        expect(item.originalName).toBe(batchFiles[i].originalName);
        expect(item.storagePath).toBe(`${firmAId}/${clientAId}/${item.documentId}`);
        expect(isValidUuid(item.documentId)).toBe(true);
      }

      expect(documentsTable).toHaveLength(3);
      expect(documentsTable.every((d) => d.status === 'uploaded')).toBe(true);
    });
  });

  describe('2. Direct Upload -> confirmUpload -> Status Queued & Enqueue Extraction', () => {
    it('completes happy path: prepare -> mock direct PUT -> confirm -> status becomes queued', async () => {
      // Step 1: Prepare
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'supplier_invoice.jpg',
          sizeBytes: 250000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('supplier_invoice_bytes'),
          periodFp: '092026',
        },
      ]);
      expect(prepRes.ok).toBe(true);
      if (!prepRes.ok) return;
      const { documentId, storagePath } = prepRes.data.prepared[0];

      // Step 2: Simulate Direct Browser PUT to Storage with valid JPEG header
      storageMap.set(storagePath, {
        bytes: JPEG_HEADER,
        mimeType: 'image/jpeg',
      });

      // Step 3: Confirm Upload
      const confirmRes = await confirmUpload(documentId);
      expect(confirmRes.ok).toBe(true);
      if (!confirmRes.ok) return;

      expect(confirmRes.data.documentId).toBe(documentId);
      expect(confirmRes.data.status).toBe('queued');

      // Step 4: Verify document status in DB transitioned to 'queued'
      const updatedDoc = documentsTable.find((d) => d.id === documentId);
      expect(updatedDoc?.status).toBe('queued');

      // Step 5: Verify enqueueExtraction was called
      expect(mockEnqueueExtraction).toHaveBeenCalledWith(documentId);
    });

    it('confirms PNG and PDF direct uploads successfully with status queued', async () => {
      // Test PNG
      const prepPng = await prepareUploads(clientAId, [
        {
          originalName: 'counter_bill.png',
          sizeBytes: 120000,
          mimeType: 'image/png',
          sha256: sha256Hex('png-bill-unique'),
        },
      ]);
      if (!prepPng.ok) throw new Error('Prep failed');
      const docPng = prepPng.data.prepared[0];

      storageMap.set(docPng.storagePath, {
        bytes: PNG_HEADER,
        mimeType: 'image/png',
      });

      const resPng = await confirmUpload(docPng.documentId);
      expect(resPng.ok).toBe(true);
      if (resPng.ok) {
        expect(resPng.data.status).toBe('queued');
      }

      // Test PDF
      const prepPdf = await prepareUploads(clientAId, [
        {
          originalName: 'b2b_gst_invoice.pdf',
          sizeBytes: 450000,
          mimeType: 'application/pdf',
          sha256: sha256Hex('pdf-bill-unique'),
        },
      ]);
      if (!prepPdf.ok) throw new Error('Prep failed');
      const docPdf = prepPdf.data.prepared[0];

      storageMap.set(docPdf.storagePath, {
        bytes: PDF_HEADER,
        mimeType: 'application/pdf',
      });

      const resPdf = await confirmUpload(docPdf.documentId);
      expect(resPdf.ok).toBe(true);
      if (resPdf.ok) {
        expect(resPdf.data.status).toBe('queued');
      }
    });

    it('is idempotent: calling confirmUpload on already queued document returns ok without error', async () => {
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'idempotent_test.jpg',
          sizeBytes: 10000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('idempotent-test-bytes'),
        },
      ]);
      if (!prepRes.ok) throw new Error('Prep failed');
      const docId = prepRes.data.prepared[0].documentId;

      storageMap.set(prepRes.data.prepared[0].storagePath, {
        bytes: JPEG_HEADER,
        mimeType: 'image/jpeg',
      });

      const firstConfirm = await confirmUpload(docId);
      expect(firstConfirm.ok).toBe(true);

      // Second confirm call on the same documentId
      const secondConfirm = await confirmUpload(docId);
      expect(secondConfirm.ok).toBe(true);
      if (secondConfirm.ok) {
        expect(secondConfirm.data.documentId).toBe(docId);
        expect(secondConfirm.data.status).toBe('queued');
      }
    });

    it('returns friendly error when uploaded storage object cannot be found on confirm', async () => {
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'missing_storage.jpg',
          sizeBytes: 15000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('missing-storage-bytes'),
        },
      ]);
      if (!prepRes.ok) throw new Error('Prep failed');
      const docId = prepRes.data.prepared[0].documentId;

      // Do NOT put into storageMap (simulating network failure or aborted PUT)
      const res = await confirmUpload(docId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('Could not find the uploaded file. Please try uploading again.');
      }

      // Verify status set to failed via fail RPC
      const doc = documentsTable.find((d) => d.id === docId);
      expect(doc?.status).toBe('failed');
    });
  });

  describe('3. Shop Owner Upload Flow (Portal Access)', () => {
    it('allows client owner to prepare and confirm uploads for their business', async () => {
      // Switch session to shop owner
      currentSession = {
        user: { id: userOwnerId, email: 'shopowner@kirana.in' } as any,
        firm: null,
        clients: [{ id: clientAId, name: 'Shree Ganesh Traders', role: 'owner' }],
        home: '/portal',
      };

      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'camera_photo.jpg',
          sizeBytes: 600000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('shop-owner-photo-1'),
          periodFp: '102026',
        },
      ]);

      expect(prepRes.ok).toBe(true);
      if (!prepRes.ok) return;

      const item = prepRes.data.prepared[0];
      expect(item.storagePath).toBe(`${firmAId}/${clientAId}/${item.documentId}`);

      // Direct PUT
      storageMap.set(item.storagePath, {
        bytes: JPEG_HEADER,
        mimeType: 'image/jpeg',
      });

      // Confirm
      const confirmRes = await confirmUpload(item.documentId);
      expect(confirmRes.ok).toBe(true);
      if (confirmRes.ok) {
        expect(confirmRes.data.status).toBe('queued');
      }
    });
  });

  describe('4. discardUpload & deleteDocument', () => {
    it('discardUpload removes storage object, invokes fail RPC, and soft deletes row', async () => {
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'to_discard.jpg',
          sizeBytes: 150000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('to-discard-bytes'),
        },
      ]);
      if (!prepRes.ok) throw new Error('Prep failed');
      const { documentId, storagePath } = prepRes.data.prepared[0];

      // Simulate partial upload in storage
      storageMap.set(storagePath, { bytes: JPEG_HEADER, mimeType: 'image/jpeg' });
      expect(storageMap.has(storagePath)).toBe(true);

      const discardRes = await discardUpload(documentId);
      expect(discardRes.ok).toBe(true);
      if (discardRes.ok) {
        expect(discardRes.data.discarded).toBe(true);
      }

      // Storage object removed
      expect(storageMap.has(storagePath)).toBe(false);

      // Status marked failed and deleted_at set for firm staff
      const doc = documentsTable.find((d) => d.id === documentId);
      expect(doc?.status).toBe('failed');
      expect(doc?.deleted_at).not.toBeNull();
    });

    it('deleteDocument soft-deletes confirmed document and hides it from listDocuments', async () => {
      // Prepare and confirm document
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'bill_to_delete.pdf',
          sizeBytes: 300000,
          mimeType: 'application/pdf',
          sha256: sha256Hex('to-delete-pdf'),
        },
      ]);
      if (!prepRes.ok) throw new Error('Prep failed');
      const { documentId, storagePath } = prepRes.data.prepared[0];

      storageMap.set(storagePath, { bytes: PDF_HEADER, mimeType: 'application/pdf' });
      await confirmUpload(documentId);

      // Verify visible in listDocuments
      const beforeList = await listDocuments(clientAId, {}, mockSupabase as any);
      expect(beforeList.items.some((d) => d.id === documentId)).toBe(true);

      // Delete document (soft delete)
      const delRes = await deleteDocument(documentId);
      expect(delRes.ok).toBe(true);
      if (delRes.ok) {
        expect(delRes.data.deleted).toBe(true);
      }

      // Verify row has deleted_at set in DB
      const docInDb = documentsTable.find((d) => d.id === documentId);
      expect(docInDb?.deleted_at).not.toBeNull();

      // Verify HIDDEN from listDocuments
      const afterList = await listDocuments(clientAId, {}, mockSupabase as any);
      expect(afterList.items.some((d) => d.id === documentId)).toBe(false);

      // getDocument also returns null for soft-deleted doc
      const singleDoc = await getDocument(documentId, mockSupabase as any);
      expect(singleDoc).toBeNull();
    });

    it('deleteDocument returns friendly error when document does not exist or was already deleted', async () => {
      const res = await deleteDocument('99999999-9999-4999-a999-999999999999');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('Document not found or already deleted.');
      }
    });
  });
});
