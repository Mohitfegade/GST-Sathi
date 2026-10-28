/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareUploads, confirmUpload } from '@/lib/uploads/actions';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  ALLOWED_MIME_TYPES,
  STORAGE_BUCKET,
} from '@/lib/uploads/limits';
import {
  DUPLICATE_MESSAGE,
  BATCH_TOO_LARGE_MESSAGE,
  RATE_LIMIT_MESSAGE,
} from '@/lib/uploads/messages';
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

const firmId = '11111111-1111-4111-a111-111111111111';
const clientAId = '22222222-2222-4222-a222-222222222222';
const clientBId = '33333333-3333-4333-a333-333333333333';
const userAccountantId = '44444444-4444-4444-a444-444444444444';

let currentSession: SessionContext | null = null;
let clientsTable: SimulatedClient[] = [];
let documentsTable: SimulatedDocument[] = [];
const storageMap = new Map<string, { bytes: Uint8Array; mimeType: string }>();
let mockQuotaAllowed = true;

function sha256Hex(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

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
        select: vi.fn((_cols?: string) => chain),
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
        return { data: mockQuotaAllowed, error: null };
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
describe('Validation & Quota Integration Tests (src/tests/uploads/validation-quota.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuotaAllowed = true;
    mockSupabase = createMockSupabase();

    clientsTable = [
      { id: clientAId, firm_id: firmId, legal_name: 'Client Alpha Ltd', deleted_at: null },
      { id: clientBId, firm_id: firmId, legal_name: 'Client Beta Ltd', deleted_at: null },
    ];
    documentsTable = [];
    storageMap.clear();

    currentSession = {
      user: { id: userAccountantId, email: 'accountant@apex.in' } as any,
      firm: { id: firmId, name: 'Apex Firm', role: 'staff' },
      clients: [],
      home: '/app',
    };
  });

  describe('1. Cryptographic Duplicate Detection (SHA-256)', () => {
    it('returns "You already sent this bill" and does not create a duplicate row for the same client', async () => {
      const fixedSha = sha256Hex('unique-grocery-bill-content-12345');

      // 1. Initial upload of the bill
      const firstRes = await prepareUploads(clientAId, [
        {
          originalName: 'march_bill.jpg',
          sizeBytes: 200000,
          mimeType: 'image/jpeg',
          sha256: fixedSha,
        },
      ]);
      expect(firstRes.ok).toBe(true);
      if (!firstRes.ok) return;
      expect(firstRes.data.prepared).toHaveLength(1);
      const existingDocId = firstRes.data.prepared[0].documentId;
      expect(documentsTable).toHaveLength(1);

      // 2. Second upload attempting to send the same SHA-256 for the same client
      const duplicateRes = await prepareUploads(clientAId, [
        {
          originalName: 'march_bill_copy.jpg',
          sizeBytes: 200000,
          mimeType: 'image/jpeg',
          sha256: fixedSha,
        },
      ]);

      expect(duplicateRes.ok).toBe(true);
      if (!duplicateRes.ok) return;

      // Duplicate detected
      expect(duplicateRes.data.prepared).toHaveLength(0);
      expect(duplicateRes.data.duplicates).toHaveLength(1);

      const dup = duplicateRes.data.duplicates[0];
      expect(dup.originalName).toBe('march_bill_copy.jpg');
      expect(dup.sha256).toBe(fixedSha);
      expect(dup.existingDocumentId).toBe(existingDocId);
      expect(dup.message).toBe(DUPLICATE_MESSAGE);

      // Verify no duplicate row was created in the database
      expect(documentsTable).toHaveLength(1);
      expect(documentsTable[0].id).toBe(existingDocId);
    });

    it('detects intra-batch duplicates when user selects identical files in a single batch', async () => {
      const identicalSha = sha256Hex('identical-photo-picked-twice');

      const batchRes = await prepareUploads(clientAId, [
        {
          originalName: 'bill_original.png',
          sizeBytes: 150000,
          mimeType: 'image/png',
          sha256: identicalSha,
        },
        {
          originalName: 'bill_original (1).png',
          sizeBytes: 150000,
          mimeType: 'image/png',
          sha256: identicalSha,
        },
      ]);

      expect(batchRes.ok).toBe(true);
      if (!batchRes.ok) return;

      // First file is prepared, second is flagged as duplicate
      expect(batchRes.data.prepared).toHaveLength(1);
      expect(batchRes.data.duplicates).toHaveLength(1);

      expect(batchRes.data.prepared[0].originalName).toBe('bill_original.png');
      expect(batchRes.data.duplicates[0].originalName).toBe('bill_original (1).png');
      expect(batchRes.data.duplicates[0].message).toBe(DUPLICATE_MESSAGE);
      expect(documentsTable).toHaveLength(1);
    });

    it('allows identical SHA-256 uploads across different clients (no cross-client collision)', async () => {
      const sharedSha = sha256Hex('wholesale-standard-distributor-catalog');

      // Client A uploads
      const resA = await prepareUploads(clientAId, [
        {
          originalName: 'supplier_invoice.pdf',
          sizeBytes: 400000,
          mimeType: 'application/pdf',
          sha256: sharedSha,
        },
      ]);
      expect(resA.ok).toBe(true);
      if (!resA.ok) return;
      expect(resA.data.prepared).toHaveLength(1);

      // Client B uploads same file - should succeed because it is for Client B
      const resB = await prepareUploads(clientBId, [
        {
          originalName: 'supplier_invoice.pdf',
          sizeBytes: 400000,
          mimeType: 'application/pdf',
          sha256: sharedSha,
        },
      ]);
      expect(resB.ok).toBe(true);
      if (!resB.ok) return;
      expect(resB.data.prepared).toHaveLength(1);
      expect(resB.data.duplicates).toHaveLength(0);

      expect(documentsTable).toHaveLength(2);
      expect(documentsTable.find((d) => d.client_id === clientAId)).toBeDefined();
      expect(documentsTable.find((d) => d.client_id === clientBId)).toBeDefined();
    });

    it('allows re-upload of a previously soft-deleted bill with the same SHA-256', async () => {
      const reuseSha = sha256Hex('reusable-sha-after-deletion');

      // 1. Initial upload
      const res1 = await prepareUploads(clientAId, [
        {
          originalName: 'first.jpg',
          sizeBytes: 100000,
          mimeType: 'image/jpeg',
          sha256: reuseSha,
        },
      ]);
      if (!res1.ok) throw new Error('Prep 1 failed');
      const docId1 = res1.data.prepared[0].documentId;

      // 2. Soft delete the first document
      const doc1 = documentsTable.find((d) => d.id === docId1);
      if (doc1) {
        doc1.deleted_at = new Date().toISOString();
      }

      // 3. Re-upload with same SHA-256
      const res2 = await prepareUploads(clientAId, [
        {
          originalName: 'second.jpg',
          sizeBytes: 100000,
          mimeType: 'image/jpeg',
          sha256: reuseSha,
        },
      ]);
      expect(res2.ok).toBe(true);
      if (!res2.ok) return;

      expect(res2.data.prepared).toHaveLength(1);
      expect(res2.data.duplicates).toHaveLength(0);
      expect(documentsTable).toHaveLength(2);
    });
  });

  describe('2. MIME Type Validation & Magic Byte Sniffing', () => {
    it('rejects unsupported MIME types during prepareUploads', async () => {
      const unsupportedFiles: PrepareUploadFile[] = [
        {
          originalName: 'spreadsheet.xlsx',
          sizeBytes: 50000,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sha256: sha256Hex('xlsx-content'),
        },
        {
          originalName: 'archive.zip',
          sizeBytes: 120000,
          mimeType: 'application/zip',
          sha256: sha256Hex('zip-content'),
        },
        {
          originalName: 'recording.mp4',
          sizeBytes: 5000000,
          mimeType: 'video/mp4',
          sha256: sha256Hex('mp4-content'),
        },
        {
          originalName: 'animation.gif',
          sizeBytes: 100000,
          mimeType: 'image/gif',
          sha256: sha256Hex('gif-content'),
        },
      ];

      const res = await prepareUploads(clientAId, unsupportedFiles);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.prepared).toHaveLength(0);
      expect(res.data.rejected).toHaveLength(4);

      for (const r of res.data.rejected) {
        expect(r.reason).toContain('Unsupported file format');
      }
      expect(documentsTable).toHaveLength(0);
    });

    it('normalizes image/jpg alias to image/jpeg and accepts it', async () => {
      const res = await prepareUploads(clientAId, [
        {
          originalName: 'photo.jpg',
          sizeBytes: 100000,
          mimeType: 'image/jpg', // alias
          sha256: sha256Hex('jpg-alias-bytes'),
        },
      ]);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.prepared).toHaveLength(1);
      expect(documentsTable[0].mime_type).toBe('image/jpeg');
    });

    it('rejects upload on confirmUpload if uploaded storage bytes do not match allowed formats (sniffing)', async () => {
      // 1. Prepare claiming image/jpeg
      const prepRes = await prepareUploads(clientAId, [
        {
          originalName: 'disguised_file.jpg',
          sizeBytes: 2000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('fake-bytes'),
        },
      ]);
      if (!prepRes.ok) throw new Error('Prep failed');
      const { documentId, storagePath } = prepRes.data.prepared[0];

      // 2. Put text/binary bytes into storage that do NOT match JPEG/PNG/PDF/WebP magic bytes
      const INVALID_BYTES = Buffer.from('Plain text fake invoice content without magic bytes');
      storageMap.set(storagePath, {
        bytes: INVALID_BYTES,
        mimeType: 'image/jpeg',
      });

      // 3. Confirm upload: sniffing must catch the mismatch
      const confirmRes = await confirmUpload(documentId);
      expect(confirmRes.ok).toBe(false);
      if (!confirmRes.ok) {
        expect(confirmRes.message).toBe(
          'Unsupported file format. Please send a clear photo or PDF bill.'
        );
      }

      // Storage object removed
      expect(storageMap.has(storagePath)).toBe(false);

      // Status marked failed in DB
      const doc = documentsTable.find((d) => d.id === documentId);
      expect(doc?.status).toBe('failed');
    });
  });

  describe('3. Oversized Files (> 10 MB)', () => {
    it('rejects files larger than 10 MB (10 * 1024 * 1024 bytes)', async () => {
      const elevenMb = 11 * 1024 * 1024;
      const justOverTenMb = MAX_FILE_SIZE_BYTES + 1;

      const res = await prepareUploads(clientAId, [
        {
          originalName: 'giant_scan.pdf',
          sizeBytes: elevenMb,
          mimeType: 'application/pdf',
          sha256: sha256Hex('giant-pdf'),
        },
        {
          originalName: 'borderline.jpg',
          sizeBytes: justOverTenMb,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('borderline-jpg'),
        },
      ]);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.prepared).toHaveLength(0);
      expect(res.data.rejected).toHaveLength(2);

      expect(res.data.rejected[0].reason).toBe(
        'This file is larger than 10 MB. Please send a smaller photo or document.'
      );
      expect(res.data.rejected[1].reason).toBe(
        'This file is larger than 10 MB. Please send a smaller photo or document.'
      );
      expect(documentsTable).toHaveLength(0);
    });

    it('rejects files with 0 or negative sizeBytes', async () => {
      const res = await prepareUploads(clientAId, [
        {
          originalName: 'empty.pdf',
          sizeBytes: 0,
          mimeType: 'application/pdf',
          sha256: sha256Hex('empty-content'),
        },
      ]);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.prepared).toHaveLength(0);
      expect(res.data.rejected).toHaveLength(1);
    });

    it('accepts file exactly equal to 10 MB limit', async () => {
      const exactlyTenMb = MAX_FILE_SIZE_BYTES;

      const res = await prepareUploads(clientAId, [
        {
          originalName: 'ten_mb_exact.pdf',
          sizeBytes: exactlyTenMb,
          mimeType: 'application/pdf',
          sha256: sha256Hex('ten-mb-content'),
        },
      ]);

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.prepared).toHaveLength(1);
      expect(res.data.rejected).toHaveLength(0);
    });
  });

  describe('4. Batch Limits (Max 20 Files per Batch)', () => {
    it('rejects empty batch upfront', async () => {
      const res = await prepareUploads(clientAId, []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe('Please select at least one bill to upload.');
      }
    });

    it('rejects batch containing 21 files (> 20 files limit)', async () => {
      const files: PrepareUploadFile[] = [];
      for (let i = 1; i <= 21; i++) {
        files.push({
          originalName: `bill_${i}.jpg`,
          sizeBytes: 50000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex(`batch-file-${i}`),
        });
      }

      const res = await prepareUploads(clientAId, files);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe(BATCH_TOO_LARGE_MESSAGE);
      }
      expect(documentsTable).toHaveLength(0);
    });

    it('accepts batch containing exactly 20 files', async () => {
      const files: PrepareUploadFile[] = [];
      for (let i = 1; i <= MAX_FILES_PER_BATCH; i++) {
        files.push({
          originalName: `bill_${i}.jpg`,
          sizeBytes: 50000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex(`batch-20-file-${i}`),
        });
      }

      const res = await prepareUploads(clientAId, files);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.prepared).toHaveLength(20);
      expect(res.data.rejected).toHaveLength(0);
      expect(res.data.duplicates).toHaveLength(0);
      expect(documentsTable).toHaveLength(20);
    });
  });

  describe('5. Upload Quota Limit (check_upload_quota)', () => {
    it('rejects uploads when check_upload_quota returns false (e.g. rate limit exceeded)', async () => {
      // Simulate quota limit exceeded
      mockQuotaAllowed = false;

      const res = await prepareUploads(clientAId, [
        {
          originalName: 'bill_over_quota.jpg',
          sizeBytes: 50000,
          mimeType: 'image/jpeg',
          sha256: sha256Hex('over-quota-bill'),
        },
      ]);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toBe(RATE_LIMIT_MESSAGE);
      }

      // Ensure no rows were inserted and no storage paths prepared
      expect(documentsTable).toHaveLength(0);
      expect(storageMap.size).toBe(0);
    });
  });
});
