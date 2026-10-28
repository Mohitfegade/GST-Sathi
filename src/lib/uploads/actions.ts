'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireFirmRole, requireClientAccess } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/require-user';
import type { ActionResult } from '@/lib/auth/types';
import type { Database } from '@/lib/database.types';
import type {
  PrepareUploadFile,
  PrepareUploadsResult,
  PreparedUpload,
  DuplicateFileNotice,
} from './types';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  ALLOWED_MIME_TYPES,
  STORAGE_BUCKET,
} from './limits';
import { buildDocumentStoragePath } from './paths';
import { sniffMimeType } from './sniff';
import { enqueueExtraction } from './enqueue';

/**
 * Extended database schema including Migration 120 uploads RPCs.
 */
type UploadsDatabase = Database & {
  public: Database['public'] & {
    Functions: Database['public']['Functions'] & {
      check_upload_quota: {
        Args: { client_id_param: string; n?: number };
        Returns: boolean;
      };
      confirm_document_upload: {
        Args: { document_id_param: string };
        Returns: unknown;
      };
      fail_document_upload: {
        Args: { document_id_param: string; reason?: string };
        Returns: unknown;
      };
      cleanup_stale_uploads: {
        Args: { client_id_param: string };
        Returns: number;
      };
    };
  };
};

/**
 * Checks whether an error is a Next.js navigation redirect exception.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') || false)
  );
}

/**
 * Prepares direct-to-storage signed upload URLs for a batch of purchase-bill files.
 * Validates batch limits, file sizes, MIME types, rate quotas, and detects duplicates.
 *
 * Authenticates either an accountant (staff/admin) or client owner.
 *
 * @param clientId - The client UUID to associate uploaded bills with
 * @param files - Array of file metadata items to prepare
 * @returns ActionResult containing prepared URLs, duplicates, and rejected files
 */
export async function prepareUploads(
  clientId: string,
  files: PrepareUploadFile[]
): Promise<ActionResult<PrepareUploadsResult>> {
  try {
    if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
      return { ok: false, message: 'Please select a valid client.' };
    }

    const cleanClientId = clientId.trim();

    // 1. Batch size validation
    if (!files || !Array.isArray(files) || files.length === 0) {
      return { ok: false, message: 'Please select at least one bill to upload.' };
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return {
        ok: false,
        message: 'You can send up to 20 bills at a time. Please select fewer bills and try again.',
      };
    }

    // 2. Authenticate session (accountant via requireFirmRole or owner via requireClientAccess)
    const session = await requireUser();
    const supabase = await createServerClient<UploadsDatabase>();
    let firmId: string;

    if (session.firm) {
      // Accountant path: firm member with at least 'staff' role
      await requireFirmRole('staff');
      firmId = session.firm.id;

      // Ensure accountant's firm owns this client
      const { data: clientRow, error: clientErr } = await supabase
        .from('clients')
        .select('id, firm_id')
        .eq('id', cleanClientId)
        .eq('firm_id', firmId)
        .is('deleted_at', null)
        .maybeSingle();

      if (clientErr || !clientRow) {
        return { ok: false, message: 'You do not have access to this client.' };
      }
    } else {
      // Client owner path: ensure access to this specific client
      await requireClientAccess(cleanClientId);

      // Look up owning firmId from database
      const { data: clientRow, error: clientErr } = await supabase
        .from('clients')
        .select('firm_id')
        .eq('id', cleanClientId)
        .is('deleted_at', null)
        .maybeSingle();

      if (clientErr || !clientRow?.firm_id) {
        return { ok: false, message: 'Client business record not found.' };
      }
      firmId = clientRow.firm_id;
    }

    // 3. Quota check: max 100 uploads per client per hour
    const { data: withinQuota, error: quotaError } = await supabase.rpc(
      'check_upload_quota',
      {
        client_id_param: cleanClientId,
        n: files.length,
      }
    );

    if (quotaError || withinQuota === false) {
      return {
        ok: false,
        message:
          'You have reached the upload limit for this hour (100 files). Please wait a while before sending more bills.',
      };
    }

    const prepared: PreparedUpload[] = [];
    const duplicates: DuplicateFileNotice[] = [];
    const rejected: Array<{ originalName: string; reason: string }> = [];

    // 4. Validate per-file attributes (size, MIME type, SHA-256)
    const validFilesToProcess: PrepareUploadFile[] = [];

    for (const file of files) {
      const rawFile = file as unknown as Record<string, unknown>;
      if (!file || typeof file !== 'object') {
        rejected.push({
          originalName: (rawFile?.originalName as string) || 'Unknown file',
          reason: 'Invalid file information provided.',
        });
        continue;
      }

      // Size check: must be > 0 and <= MAX_FILE_SIZE_BYTES (10MB)
      if (
        typeof file.sizeBytes !== 'number' ||
        file.sizeBytes <= 0 ||
        file.sizeBytes > MAX_FILE_SIZE_BYTES
      ) {
        rejected.push({
          originalName: file.originalName,
          reason: 'This file is larger than 10 MB. Please send a smaller photo or document.',
        });
        continue;
      }

      // MIME type check
      const rawMime = (file.mimeType || '').trim().toLowerCase();
      const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(normalizedMime)) {
        rejected.push({
          originalName: file.originalName,
          reason: 'Unsupported file format. Please send a clear photo or PDF bill.',
        });
        continue;
      }

      // SHA-256 hex string validation
      if (!file.sha256 || typeof file.sha256 !== 'string' || file.sha256.length !== 64) {
        rejected.push({
          originalName: file.originalName,
          reason: 'Could not compute file checksum. Please try again.',
        });
        continue;
      }

      validFilesToProcess.push({
        ...file,
        mimeType: normalizedMime,
      });
    }

    // 5. Query active documents for duplicates (same client_id and sha256)
    const shaList = Array.from(new Set(validFilesToProcess.map((f) => f.sha256)));
    const existingDbDocs = new Map<string, string>();

    if (shaList.length > 0) {
      const { data: foundDocs, error: dupError } = await supabase
        .from('documents')
        .select('id, sha256')
        .eq('client_id', cleanClientId)
        .is('deleted_at', null)
        .in('sha256', shaList);

      if (!dupError && foundDocs) {
        for (const d of foundDocs) {
          if (d.sha256) {
            existingDbDocs.set(d.sha256, d.id);
          }
        }
      }
    }

    // 6. Process non-duplicates: insert document row and create signed upload URL
    const batchSeenSha = new Map<string, string>();

    for (const file of validFilesToProcess) {
      // Check database duplicate
      const existingDocId = existingDbDocs.get(file.sha256);
      if (existingDocId) {
        duplicates.push({
          originalName: file.originalName,
          sha256: file.sha256,
          existingDocumentId: existingDocId,
          message: 'You already sent this bill',
        });
        continue;
      }

      // Check intra-batch duplicate
      const batchDocId = batchSeenSha.get(file.sha256);
      if (batchDocId) {
        duplicates.push({
          originalName: file.originalName,
          sha256: file.sha256,
          existingDocumentId: batchDocId,
          message: 'You already sent this bill',
        });
        continue;
      }

      const documentId = crypto.randomUUID();
      const storagePath = buildDocumentStoragePath(firmId, cleanClientId, documentId);

      let cleanPeriodFp: string | null = null;
      if (file.periodFp && /^(0[1-9]|1[0-2])[0-9]{4}$/.test(file.periodFp)) {
        cleanPeriodFp = file.periodFp;
      }

      // Insert document row with status 'uploaded'
      const { error: insertError } = await supabase.from('documents').insert({
        id: documentId,
        firm_id: firmId,
        client_id: cleanClientId,
        kind: 'purchase_bill',
        storage_path: storagePath,
        original_name: file.originalName,
        mime_type: file.mimeType,
        size_bytes: file.sizeBytes,
        sha256: file.sha256,
        status: 'uploaded',
        uploaded_by: session.user.id,
        period_fp: cleanPeriodFp,
      });

      if (insertError) {
        if (insertError.code === '23505' || insertError.message?.includes('unique')) {
          duplicates.push({
            originalName: file.originalName,
            sha256: file.sha256,
            existingDocumentId: documentId,
            message: 'You already sent this bill',
          });
        } else {
          rejected.push({
            originalName: file.originalName,
            reason: 'Could not prepare this bill for upload. Please try again.',
          });
        }
        continue;
      }

      // Create signed direct-upload URL for Supabase storage
      const { data: signData, error: signError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signError || !signData) {
        // Rollback inserted row if signed URL creation failed
        await supabase.from('documents').delete().eq('id', documentId);
        rejected.push({
          originalName: file.originalName,
          reason: 'Could not create an upload link for this bill. Please try again.',
        });
        continue;
      }

      batchSeenSha.set(file.sha256, documentId);

      prepared.push({
        documentId,
        originalName: file.originalName,
        storagePath,
        signedUploadUrl:
          (signData as { signedUrl?: string }).signedUrl ||
          (signData as unknown as { signedUploadUrl?: string }).signedUploadUrl ||
          '',
        token: signData.token,
      });
    }

    return {
      ok: true,
      data: {
        prepared,
        duplicates,
        rejected,
      },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: 'An unexpected error occurred while preparing your uploads.',
    };
  }
}

/**
 * Confirms a direct-to-storage upload: downloads the first bytes, sniffs magic bytes
 * against ALLOWED_MIME_TYPES, fails and deletes from storage on invalid types,
 * or confirms the upload in the database and enqueues extraction.
 *
 * @param documentId - The document UUID to confirm
 * @returns ActionResult with the confirmed document status
 */
export async function confirmUpload(
  documentId: string
): Promise<ActionResult<{ documentId: string; status: 'queued' }>> {
  try {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      return { ok: false, message: 'Invalid document identifier.' };
    }

    const cleanDocId = documentId.trim();
    const session = await requireUser();
    const supabase = await createServerClient<UploadsDatabase>();

    // 1. Fetch document row from DB
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, firm_id, client_id, storage_path, mime_type, status')
      .eq('id', cleanDocId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !doc) {
      return { ok: false, message: 'Document not found.' };
    }

    // 2. Authenticate session: staff or client owner with access
    const isFirmMember = !!(session.firm && session.firm.id === doc.firm_id);
    const isClientOwner = session.clients.some((c) => c.id === doc.client_id);
    if (!isFirmMember && !isClientOwner) {
      return { ok: false, message: 'You do not have access to this document.' };
    }

    // Idempotent: if already queued, return success immediately
    if (doc.status === 'queued') {
      return {
        ok: true,
        data: { documentId: cleanDocId, status: 'queued' },
      };
    }

    // 3. Download bytes from storage to sniff magic bytes
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(doc.storage_path);

    if (downloadError || !fileBlob) {
      await supabase.rpc('fail_document_upload', {
        document_id_param: cleanDocId,
        reason: 'File not found in storage',
      });
      return {
        ok: false,
        message: 'Could not find the uploaded file. Please try uploading again.',
      };
    }

    // 4. Sniff magic bytes using sniffMimeType (from '@/lib/uploads/sniff')
    const arrayBuffer = await fileBlob.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const detectedMime = sniffMimeType(bytes);

    // 5. If bytes invalid or not in ALLOWED_MIME_TYPES:
    const isValidMime =
      detectedMime !== null && (ALLOWED_MIME_TYPES as readonly string[]).includes(detectedMime);

    if (!isValidMime) {
      // Delete object from storage
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
      } catch {
        // Storage remove error should not block fail RPC
      }

      // Call RPC fail_document_upload(documentId, 'Invalid file type')
      await supabase.rpc('fail_document_upload', {
        document_id_param: cleanDocId,
        reason: 'Invalid file type',
      });

      // Return friendly error
      return {
        ok: false,
        message: 'Unsupported file format. Please send a clear photo or PDF bill.',
      };
    }

    // 6. If valid: call RPC confirm_document_upload(documentId)
    const { error: confirmError } = await supabase.rpc('confirm_document_upload', {
      document_id_param: cleanDocId,
    });

    if (confirmError) {
      return {
        ok: false,
        message: confirmError.message || 'Could not verify the bill. Please try again.',
      };
    }

    // 7. Enqueue background text/data extraction (stub)
    await enqueueExtraction(cleanDocId);

    return {
      ok: true,
      data: {
        documentId: cleanDocId,
        status: 'queued',
      },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: 'An unexpected error occurred while confirming the upload.',
    };
  }
}

/**
 * Discards an unconfirmed or cancelled upload. Deletes the storage object if present
 * and marks the document row as failed/deleted.
 *
 * @param documentId - The document UUID to discard
 * @returns ActionResult indicating success
 */
export async function discardUpload(
  documentId: string
): Promise<ActionResult<{ documentId: string; discarded: boolean }>> {
  try {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      return { ok: false, message: 'Invalid document identifier.' };
    }

    const cleanDocId = documentId.trim();
    const session = await requireUser();
    const supabase = await createServerClient<UploadsDatabase>();

    // Fetch document row from DB
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, firm_id, client_id, storage_path, status')
      .eq('id', cleanDocId)
      .maybeSingle();

    if (fetchErr || !doc) {
      return { ok: false, message: 'Document not found.' };
    }

    // Verify access
    const isFirmMember = !!(session.firm && session.firm.id === doc.firm_id);
    const isClientOwner = session.clients.some((c) => c.id === doc.client_id);
    if (!isFirmMember && !isClientOwner) {
      return { ok: false, message: 'You do not have access to this document.' };
    }

    // Delete object from storage if exists
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
    } catch {
      // Storage removal failure should not abort discard
    }

    // Call fail_document_upload RPC
    await supabase.rpc('fail_document_upload', {
      document_id_param: cleanDocId,
      reason: 'Upload cancelled by user',
    });

    // If firm member, soft delete the row
    if (isFirmMember) {
      await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', cleanDocId);
    }

    return {
      ok: true,
      data: {
        documentId: cleanDocId,
        discarded: true,
      },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { ok: false, message: 'Could not cancel upload.' };
  }
}

/**
 * Soft deletes a document row (sets deleted_at timestamp).
 * Ensures the requesting user has permission (staff member of firm or client owner).
 *
 * @param documentId - The document UUID to soft delete
 * @returns ActionResult indicating deletion status
 */
export async function deleteDocument(
  documentId: string
): Promise<ActionResult<{ id: string; deleted: boolean }>> {
  try {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      return { ok: false, message: 'Invalid document identifier.' };
    }

    const cleanDocId = documentId.trim();
    const session = await requireUser();
    const supabase = await createServerClient<UploadsDatabase>();

    // Fetch document row to verify permissions
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('id, firm_id, client_id, deleted_at')
      .eq('id', cleanDocId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !doc) {
      return { ok: false, message: 'Document not found or already deleted.' };
    }

    // Verify user has permission (staff or owner)
    const isFirmMember = !!(session.firm && session.firm.id === doc.firm_id);
    const isClientOwner = session.clients.some((c) => c.id === doc.client_id);
    if (!isFirmMember && !isClientOwner) {
      return { ok: false, message: 'You do not have permission to delete this bill.' };
    }

    // Soft delete document row
    const { error: updateError } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cleanDocId);

    if (updateError) {
      return { ok: false, message: 'Could not delete bill. Please try again.' };
    }

    return {
      ok: true,
      data: {
        id: cleanDocId,
        deleted: true,
      },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { ok: false, message: 'Could not delete bill. Please try again.' };
  }
}
