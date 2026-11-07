import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { Database, Tables } from '@/lib/database.types';
import type {
  DocumentFilters,
  DocumentListItem,
  DocumentStatusCounts,
  PaginatedDocuments,
} from './types';
import { PREVIEW_URL_EXPIRY_SECONDS, STORAGE_BUCKET } from './limits';

export const DEFAULT_PAGE_SIZE = 20;

export type DocumentRow = Tables<'documents'>;

/**
 * Maps a raw Supabase database row from the `documents` table
 * to the UI-facing `DocumentListItem` model.
 */
export function mapRowToDocumentListItem(row: DocumentRow): DocumentListItem {
  return {
    id: row.id,
    firmId: row.firm_id,
    clientId: row.client_id,
    kind: row.kind,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
    uploadedBy: row.uploaded_by ?? null,
    periodFp: row.period_fp ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 1. listDocuments
 * Queries active documents (`deleted_at is null`) for a client.
 *
 * - Session authentication: works for firm staff or client owner via Supabase RLS.
 * - Filter by clientId and deleted_at is null.
 * - Filter by status if provided and !== 'all'.
 * - Filter by periodFp if provided and !== 'all'.
 * - Order by created_at desc.
 * - Supports pagination (default pageSize = 20, page = Math.max(1, filters.page ?? 1)).
 * - Returns PaginatedDocuments { items, total, page, pageSize, totalPages }.
 */
export async function listDocuments(
  clientId: string,
  filters: DocumentFilters = {},
  client?: SupabaseClient<Database>
): Promise<PaginatedDocuments> {
  const page = Math.max(1, Number.isFinite(filters.page) ? Math.floor(filters.page!) : 1);
  const pageSize =
    filters.pageSize && Number.isFinite(filters.pageSize) && filters.pageSize > 0
      ? Math.floor(filters.pageSize)
      : DEFAULT_PAGE_SIZE;

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  if (!client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }
  }

  try {
    const supabase = client ?? (await createServerClient<Database>());
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId.trim())
      .is('deleted_at', null);

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.periodFp && filters.periodFp !== 'all') {
      query = query.eq('period_fp', filters.periodFp);
    }

    query = query.order('created_at', { ascending: false });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      if (!client) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      throw error;
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const items = (data ?? []).map(mapRowToDocumentListItem);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    if (!client) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    throw err;
  }
}

/**
 * 2. getDocument
 * Looks up a single document by ID where deleted_at is null.
 * Respects RLS (works for firm staff or client owner).
 *
 * Returns DocumentListItem or null if not found or unauthorized.
 */
export async function getDocument(
  documentId: string,
  client?: SupabaseClient<Database>
): Promise<DocumentListItem | null> {
  if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
    return null;
  }

  const supabase = client ?? (await createServerClient<Database>());

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId.trim())
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToDocumentListItem(data);
}

/**
 * 3. createPreviewUrl
 * Creates a 5-minute signed URL using supabase.storage.from('documents').createSignedUrl(storagePath, 300).
 *
 * Returns signedUrl string or null on error.
 */
export async function createPreviewUrl(
  storagePath: string,
  client?: SupabaseClient<Database>
): Promise<string | null> {
  if (!storagePath || typeof storagePath !== 'string' || storagePath.trim() === '') {
    return null;
  }

  if (!client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      return null;
    }
  }

  try {
    const supabase = client ?? (await createServerClient<Database>());
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath.trim(), PREVIEW_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * 4. getDocumentStatusCounts
 * Aggregates count of active documents for this client grouped by status
 * (uploaded, queued, processing, needs_review, done, failed).
 *
 * Returns DocumentStatusCounts.
 */
export async function getDocumentStatusCounts(
  clientId: string,
  client?: SupabaseClient<Database>
): Promise<DocumentStatusCounts> {
  const counts: DocumentStatusCounts = {
    total: 0,
    uploaded: 0,
    queued: 0,
    processing: 0,
    needsReview: 0,
    done: 0,
    failed: 0,
  };

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    return counts;
  }

  if (!client) {
    let hasAuthCookie = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      hasAuthCookie = cookieStore.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.includes('-auth-token')
      );
    } catch {
      // outside request context
    }
    if (!hasAuthCookie) {
      return counts;
    }
  }

  try {
    const supabase = client ?? (await createServerClient<Database>());

    const { data, error } = await supabase
      .from('documents')
      .select('status')
      .eq('client_id', clientId.trim())
      .is('deleted_at', null);

    if (error) {
      if (!client) {
        return counts;
      }
      throw error;
    }

    if (data) {
      for (const row of data) {
        counts.total += 1;
        switch (row.status) {
          case 'uploaded':
            counts.uploaded += 1;
            break;
          case 'queued':
            counts.queued += 1;
            break;
          case 'processing':
            counts.processing += 1;
            break;
          case 'needs_review':
            counts.needsReview += 1;
            break;
          case 'done':
            counts.done += 1;
            break;
          case 'failed':
            counts.failed += 1;
            break;
        }
      }
    }

    return counts;
  } catch (err) {
    if (!client) {
      return counts;
    }
    throw err;
  }
}
