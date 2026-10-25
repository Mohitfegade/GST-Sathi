import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const docKindSchema = z.enum([
  'purchase_bill',
  'gstr2b_file',
  'sales_file',
  'bank_file',
  'other',
]);
export type DocKind = z.infer<typeof docKindSchema>;

export const docStatusSchema = z.enum([
  'uploaded',
  'queued',
  'processing',
  'needs_review',
  'done',
  'failed',
]);
export type DocStatus = z.infer<typeof docStatusSchema>;

// ============================================================================
// Validators
// ============================================================================

/**
 * SHA-256 cryptographic hex digest validator:
 * Exactly 64 hexadecimal characters (case-insensitive for input, standard lowercase check).
 */
export const SHA256_REGEX = /^[0-9a-fA-F]{64}$/;

export const sha256Schema = z
  .string()
  .length(64, 'SHA-256 hash must be exactly 64 characters')
  .regex(SHA256_REGEX, 'SHA-256 must be a valid 64-character hexadecimal string');
export type Sha256 = z.infer<typeof sha256Schema>;

export function isValidSha256(hash: string): boolean {
  return SHA256_REGEX.test(hash);
}

/**
 * GST Return Filing Period format: "MMYYYY"
 * Examples: "102026" (October 2026), "042026" (April 2026).
 * Must be 2-digit month (01-12) followed by 4-digit calendar year.
 */
export const PERIOD_FP_REGEX = /^(0[1-9]|1[0-2])[0-9]{4}$/;

export const periodFpSchema = z
  .string()
  .length(6, 'period_fp must be exactly 6 digits')
  .regex(PERIOD_FP_REGEX, 'period_fp must be in MMYYYY format (e.g. "102026")');
export type PeriodFp = z.infer<typeof periodFpSchema>;

export function isValidPeriodFp(periodFp: string): boolean {
  return PERIOD_FP_REGEX.test(periodFp);
}

// ============================================================================
// Document Entity Schemas
// ============================================================================

export const documentSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  kind: docKindSchema,
  storage_path: z.string().min(1, 'storage_path is required'),
  original_name: z.string().min(1, 'original_name is required'),
  mime_type: z.string().min(1, 'mime_type is required'),
  size_bytes: z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/, 'size_bytes must be a non-negative integer string'),
  ]),
  sha256: sha256Schema,
  status: docStatusSchema.default('uploaded'),
  uploaded_by: z.string().uuid(),
  period_fp: periodFpSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type Document = z.infer<typeof documentSchema>;

export const documentInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  kind: docKindSchema,
  storage_path: z.string().min(1, 'storage_path is required'),
  original_name: z.string().min(1, 'original_name is required'),
  mime_type: z.string().min(1, 'mime_type is required'),
  size_bytes: z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/, 'size_bytes must be a non-negative integer string'),
  ]),
  sha256: sha256Schema,
  status: docStatusSchema.default('uploaded').optional(),
  uploaded_by: z.string().uuid(),
  period_fp: periodFpSchema.nullable().optional(),
});
export type DocumentInsert = z.infer<typeof documentInsertSchema>;

export const documentUpdateSchema = documentInsertSchema
  .omit({ id: true, firm_id: true, client_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
