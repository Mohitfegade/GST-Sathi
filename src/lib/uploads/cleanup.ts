import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/** Supabase storage bucket name for private document storage */
export const STORAGE_BUCKET = 'documents';

/** Default stale upload timeout in hours (unconfirmed 'uploaded' status rows) */
export const DEFAULT_STALE_UPLOAD_TIMEOUT_HOURS = 1;

export interface CleanupUploadsOptions {
  clientId?: string;
  maxAgeHours?: number;
  adminClient?: SupabaseClient<Database> | unknown;
  supabaseClient?: SupabaseClient<Database> | unknown;
}

export interface CleanupUploadsResult {
  totalCleaned: number;
  storageObjectsRemoved: number;
  errors: string[];
}

/**
 * Resolves or initializes the admin Supabase client.
 * In a Next.js server runtime, attempts to use createAdminClient() from '@/lib/supabase/admin'.
 * In standalone scripts or tests, falls back to initializing a client using environment variables.
 */
async function resolveAdminClient(
  providedClient?: SupabaseClient<Database> | unknown
): Promise<SupabaseClient<Database>> {
  if (providedClient) {
    return providedClient as SupabaseClient<Database>;
  }

  // Attempt to use createAdminClient from @/lib/supabase/admin when running in Next.js server runtime
  try {
    const adminMod = (await import('@/lib/supabase/admin')) as {
      createAdminClient?: <T = Database>() => SupabaseClient<T>;
    };
    if (typeof adminMod.createAdminClient === 'function') {
      return adminMod.createAdminClient<Database>() as unknown as SupabaseClient<Database>;
    }
  } catch {
    // Fall back to direct initialization for standalone CLI scripts / Node runtime
  }

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'http://127.0.0.1:54321';

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Finds unconfirmed documents in public.documents where status = 'uploaded' and
 * created_at is older than the configured threshold (default: 1 hour).
 *
 * For each stale document found:
 * 1. Removes the associated storage object from the 'documents' bucket if it exists.
 * 2. Marks the document as soft-deleted by setting deleted_at = current timestamp.
 *
 * @param options Configuration options (optional clientId filter, maxAgeHours, custom admin client)
 * @returns Summary of totalCleaned records, storageObjectsRemoved count, and any errors encountered
 */
export async function cleanupStaleUploads(
  options?: CleanupUploadsOptions
): Promise<CleanupUploadsResult> {
  const errors: string[] = [];
  let totalCleaned = 0;
  let storageObjectsRemoved = 0;

  let supabase: SupabaseClient<Database>;
  try {
    supabase = await resolveAdminClient(options?.adminClient || options?.supabaseClient);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      totalCleaned: 0,
      storageObjectsRemoved: 0,
      errors: [`Failed to initialize admin Supabase client: ${message}`],
    };
  }

  const maxAge =
    typeof options?.maxAgeHours === 'number' &&
    !Number.isNaN(options.maxAgeHours) &&
    options.maxAgeHours >= 0
      ? options.maxAgeHours
      : DEFAULT_STALE_UPLOAD_TIMEOUT_HOURS;

  const cutoffIso = new Date(Date.now() - maxAge * 60 * 60 * 1000).toISOString();

  // Find unconfirmed documents in public.documents where status = 'uploaded' and created_at < cutoff
  let query = supabase
    .from('documents')
    .select('id, firm_id, client_id, storage_path, status, created_at, deleted_at')
    .eq('status', 'uploaded')
    .is('deleted_at', null)
    .lt('created_at', cutoffIso)
    .order('created_at', { ascending: true });

  const targetClientId = options?.clientId?.trim();
  if (targetClientId) {
    query = query.eq('client_id', targetClientId);
  }

  const { data: staleDocs, error: selectError } = await query;

  if (selectError) {
    return {
      totalCleaned: 0,
      storageObjectsRemoved: 0,
      errors: [`Failed to query stale documents: ${selectError.message}`],
    };
  }

  if (!staleDocs || staleDocs.length === 0) {
    return {
      totalCleaned: 0,
      storageObjectsRemoved: 0,
      errors: [],
    };
  }

  // Process each stale document
  for (const doc of staleDocs) {
    // 1. Remove storage object from storage bucket 'documents' if it exists
    if (doc.storage_path && doc.storage_path.trim().length > 0) {
      try {
        const { data: removeData, error: removeError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([doc.storage_path]);

        if (removeError) {
          errors.push(
            `Document ${doc.id}: failed to remove storage object (${doc.storage_path}): ${removeError.message}`
          );
        } else if (removeData && removeData.length > 0) {
          storageObjectsRemoved += removeData.length;
        }
      } catch (storageErr) {
        const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
        errors.push(
          `Document ${doc.id}: exception removing storage object (${doc.storage_path}): ${msg}`
        );
      }
    }

    // 2. Mark document as soft-deleted
    try {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          deleted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', doc.id)
        .is('deleted_at', null);

      if (updateError) {
        errors.push(
          `Document ${doc.id}: failed to mark as deleted: ${updateError.message}`
        );
      } else {
        totalCleaned++;
      }
    } catch (updateErr) {
      const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
      errors.push(
        `Document ${doc.id}: exception marking as deleted: ${msg}`
      );
    }
  }

  return {
    totalCleaned,
    storageObjectsRemoved,
    errors,
  };
}
