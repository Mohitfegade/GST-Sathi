'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireFirmRole } from '@/lib/auth/roles';
import type { ActionResult } from '@/lib/auth/types';
import type { Database } from '@/lib/database.types';
import { clientFormSchema } from '@/lib/clients/schema';
import { CLIENT_MESSAGES } from '@/lib/clients/messages';
import { schemeSchema, aatoBandSchema, langSchema, GSTIN_REGEX } from '@/lib/domain/tenancy';
import { validateGstin } from '@/lib/gst/gstin';

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
 * Fallback Zod validation schema if clientFormSchema is unavailable or requires fallback.
 */
const fallbackClientFormSchema = z
  .object({
    legal_name: z
      .string()
      .trim()
      .min(1, 'Please enter the legal business name.'),
    trade_name: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    gstin: z
      .string()
      .trim()
      .toUpperCase(),
    scheme: schemeSchema.default('regular'),
    aato_band: aatoBandSchema.default('below_40l'),
    sells_exempt: z.boolean().default(false),
    sells_taxable: z.boolean().default(true),
    language: langSchema.default('en'),
  })
  .superRefine((data, ctx) => {
    if (!data.gstin || data.gstin.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter the GSTIN.',
        path: ['gstin'],
      });
      return;
    }

    if (data.gstin.length !== 15 || !GSTIN_REGEX.test(data.gstin)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter a valid 15-character GSTIN.',
        path: ['gstin'],
      });
      return;
    }

    const gstinResult = validateGstin(data.gstin);
    if (!gstinResult.valid) {
      const isChecksumError = gstinResult.error?.toLowerCase().includes('checksum');
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isChecksumError
          ? 'GSTIN checksum verification failed. Please check the number.'
          : 'Please enter a valid 15-character GSTIN.',
        path: ['gstin'],
      });
    }

    if (!data.sells_exempt && !data.sells_taxable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select at least one: tax-free or taxable goods.',
        path: ['sells_taxable'],
      });
    }
  });

/**
 * Normalizes unknown input (plain object or FormData) into a clean record.
 */
function normalizeInputData(data: unknown): Record<string, unknown> {
  if (data instanceof FormData) {
    const raw: Record<string, unknown> = {};
    for (const [key, value] of data.entries()) {
      raw[key] = value;
    }
    return {
      legal_name: typeof raw.legal_name === 'string' ? raw.legal_name.trim() : raw.legal_name,
      trade_name: typeof raw.trade_name === 'string' ? raw.trade_name.trim() : raw.trade_name,
      gstin: typeof raw.gstin === 'string' ? raw.gstin.trim().toUpperCase() : raw.gstin,
      scheme: raw.scheme,
      aato_band: raw.aato_band,
      sells_exempt: raw.sells_exempt === 'true' || raw.sells_exempt === 'on' || raw.sells_exempt === true,
      sells_taxable: raw.sells_taxable === 'true' || raw.sells_taxable === 'on' || raw.sells_taxable === true,
      language: raw.language,
    };
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    return {
      ...obj,
      legal_name: typeof obj.legal_name === 'string' ? obj.legal_name.trim() : obj.legal_name,
      trade_name: typeof obj.trade_name === 'string' ? obj.trade_name.trim() : obj.trade_name,
      gstin: typeof obj.gstin === 'string' ? obj.gstin.trim().toUpperCase() : obj.gstin,
    };
  }

  return {};
}

/**
 * Validates input data using clientFormSchema or fallback.
 */
function validateClientForm(data: unknown) {
  const normalized = normalizeInputData(data);
  const activeSchema = clientFormSchema || fallbackClientFormSchema;
  return activeSchema.safeParse(normalized);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Creates a new SME client business record for the active accounting firm.
 * Accessible to firm staff and admins.
 *
 * @param data - Raw form data or payload object
 * @returns ActionResult with the newly created client UUID
 */
export async function createClient(
  data: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Authenticate with requireFirmRole('staff')
    const session = await requireFirmRole('staff');

    // 2. Validate input using clientFormSchema
    const parseResult = validateClientForm(data);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return {
        ok: false,
        message: issue?.message || CLIENT_MESSAGES.errors.generic,
        field: String(issue?.path[0] || ''),
      };
    }

    const validData = parseResult.data;

    // 3. Derive state_code from first two digits of gstin
    const state_code = validData.gstin.slice(0, 2);

    const supabase = await createServerClient<Database>();

    // 4. Check duplicate GSTIN in same firm among active clients
    const { data: existingActive } = await supabase
      .from('clients')
      .select('id')
      .eq('firm_id', session.firm.id)
      .eq('gstin', validData.gstin)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingActive) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
        field: 'gstin',
      };
    }

    // 5. Insert into clients table using session client createServerClient()
    const { data: inserted, error: insertError } = await supabase
      .from('clients')
      .insert({
        firm_id: session.firm.id,
        legal_name: validData.legal_name,
        trade_name: validData.trade_name ?? null,
        gstin: validData.gstin,
        state_code,
        scheme: validData.scheme,
        aato_band: validData.aato_band,
        sells_exempt: validData.sells_exempt,
        sells_taxable: validData.sells_taxable,
        language: validData.language,
      })
      .select('id')
      .single();

    if (insertError) {
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('uq_clients_firm_gstin_active') ||
        insertError.details?.includes('uq_clients_firm_gstin_active')
      ) {
        return {
          ok: false,
          message: CLIENT_MESSAGES.errors.duplicateGstin,
          field: 'gstin',
        };
      }

      return {
        ok: false,
        message: insertError.message || CLIENT_MESSAGES.errors.generic,
      };
    }

    // 6. Revalidate /app/clients and return success
    revalidatePath('/app/clients');

    return {
      ok: true,
      data: { id: inserted.id },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : CLIENT_MESSAGES.errors.generic,
    };
  }
}

/**
 * Updates an active client business record.
 * Accessible to firm staff and admins.
 *
 * @param id - Client UUID
 * @param data - Updated form data or payload object
 * @returns ActionResult with the updated client UUID
 */
export async function updateClient(
  id: string,
  data: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return { ok: false, message: 'A valid client identifier is required.' };
    }

    const clientId = id.trim();

    // 1. Authenticate with requireFirmRole('staff')
    const session = await requireFirmRole('staff');

    // 2. Validate input
    const parseResult = validateClientForm(data);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return {
        ok: false,
        message: issue?.message || CLIENT_MESSAGES.errors.generic,
        field: String(issue?.path[0] || ''),
      };
    }

    const validData = parseResult.data;

    // 3. Derive state_code from first two digits of gstin
    const state_code = validData.gstin.slice(0, 2);

    const supabase = await createServerClient<Database>();

    // 4. Check duplicate GSTIN (different active client with same GSTIN in this firm)
    const { data: duplicateClient } = await supabase
      .from('clients')
      .select('id')
      .eq('firm_id', session.firm.id)
      .eq('gstin', validData.gstin)
      .neq('id', clientId)
      .is('deleted_at', null)
      .maybeSingle();

    if (duplicateClient) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
        field: 'gstin',
      };
    }

    // 5. Update clients where id = id and firm_id = session.firm.id and deleted_at is null
    const { data: updated, error: updateError } = await supabase
      .from('clients')
      .update({
        legal_name: validData.legal_name,
        trade_name: validData.trade_name ?? null,
        gstin: validData.gstin,
        state_code,
        scheme: validData.scheme,
        aato_band: validData.aato_band,
        sells_exempt: validData.sells_exempt,
        sells_taxable: validData.sells_taxable,
        language: validData.language,
      })
      .eq('id', clientId)
      .eq('firm_id', session.firm.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (updateError) {
      if (
        updateError.code === '23505' ||
        updateError.message?.includes('uq_clients_firm_gstin_active') ||
        updateError.details?.includes('uq_clients_firm_gstin_active')
      ) {
        return {
          ok: false,
          message: CLIENT_MESSAGES.errors.duplicateGstin,
          field: 'gstin',
        };
      }

      return {
        ok: false,
        message: updateError.message || CLIENT_MESSAGES.errors.generic,
      };
    }

    if (!updated) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.clientNotFound,
      };
    }

    // 6. Revalidate /app/clients and /app/clients/[id]
    revalidatePath('/app/clients');
    revalidatePath(`/app/clients/${clientId}`);
    revalidatePath('/app/clients/[id]');

    return {
      ok: true,
      data: { id: updated.id },
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : CLIENT_MESSAGES.errors.generic,
    };
  }
}

/**
 * Hides (soft-deletes) an SME client business record.
 * Accessible only to firm administrators.
 *
 * @param id - Client UUID
 */
export async function archiveClient(id: string): Promise<ActionResult<void>> {
  try {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return { ok: false, message: 'A valid client identifier is required.' };
    }

    const clientId = id.trim();

    // 1. Authenticate with requireFirmRole('admin')!
    // If staff attempts, return friendly error without uncaught redirect
    const session = await requireFirmRole('staff');
    if (session.firm.role !== 'admin') {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.onlyAdminCanArchive,
      };
    }
    await requireFirmRole('admin');

    // 2. Soft delete: update clients set deleted_at = now() where id = id and firm_id = session.firm.id
    const supabase = await createServerClient<Database>();
    const { data: updated, error: archiveError } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', clientId)
      .eq('firm_id', session.firm.id)
      .select('id')
      .maybeSingle();

    if (archiveError) {
      return {
        ok: false,
        message: archiveError.message || CLIENT_MESSAGES.errors.generic,
      };
    }

    if (!updated) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.clientNotFound,
      };
    }

    // 3. Revalidate /app/clients
    revalidatePath('/app/clients');
    revalidatePath(`/app/clients/${clientId}`);
    revalidatePath('/app/clients/[id]');

    return {
      ok: true,
      data: undefined,
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : CLIENT_MESSAGES.errors.generic,
    };
  }
}

/**
 * Restores a previously hidden (soft-deleted) SME client business record.
 * Accessible only to firm administrators.
 *
 * @param id - Client UUID
 */
export async function restoreClient(id: string): Promise<ActionResult<void>> {
  try {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return { ok: false, message: 'A valid client identifier is required.' };
    }

    const clientId = id.trim();

    // 1. Authenticate with requireFirmRole('admin')!
    const session = await requireFirmRole('staff');
    if (session.firm.role !== 'admin') {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.onlyAdminCanRestore,
      };
    }
    await requireFirmRole('admin');

    const supabase = await createServerClient<Database>();

    // 2. Fetch the target client to obtain its GSTIN
    const { data: targetClient, error: fetchError } = await supabase
      .from('clients')
      .select('id, gstin, deleted_at')
      .eq('id', clientId)
      .eq('firm_id', session.firm.id)
      .maybeSingle();

    if (fetchError || !targetClient) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.clientNotFound,
      };
    }

    // 3. Check if another active client in this firm already uses this GSTIN
    const { data: conflictActive } = await supabase
      .from('clients')
      .select('id')
      .eq('firm_id', session.firm.id)
      .eq('gstin', targetClient.gstin)
      .neq('id', clientId)
      .is('deleted_at', null)
      .maybeSingle();

    if (conflictActive) {
      return {
        ok: false,
        message: CLIENT_MESSAGES.errors.duplicateGstin,
      };
    }

    // 4. Set deleted_at = null where id = id and firm_id = session.firm.id
    const { error: restoreError } = await supabase
      .from('clients')
      .update({ deleted_at: null })
      .eq('id', clientId)
      .eq('firm_id', session.firm.id);

    if (restoreError) {
      if (
        restoreError.code === '23505' ||
        restoreError.message?.includes('uq_clients_firm_gstin_active') ||
        restoreError.details?.includes('uq_clients_firm_gstin_active')
      ) {
        return {
          ok: false,
          message: CLIENT_MESSAGES.errors.duplicateGstin,
        };
      }

      return {
        ok: false,
        message: restoreError.message || CLIENT_MESSAGES.errors.generic,
      };
    }

    // 5. Revalidate /app/clients
    revalidatePath('/app/clients');
    revalidatePath(`/app/clients/${clientId}`);
    revalidatePath('/app/clients/[id]');

    return {
      ok: true,
      data: undefined,
    };
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : CLIENT_MESSAGES.errors.generic,
    };
  }
}
