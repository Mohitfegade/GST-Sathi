import { z } from 'zod';
import { gstinSchema } from './tenancy';
import { periodFpSchema } from './documents';

// =============================================================================
// Enums
// =============================================================================

export const gstr2bSectionSchema = z.enum(['b2b', 'b2ba', 'cdnr', 'cdnra']);
export type Gstr2bSection = z.infer<typeof gstr2bSectionSchema>;

export const imsActionSchema = z.enum(['none', 'accepted', 'rejected', 'pending']);
export type ImsAction = z.infer<typeof imsActionSchema>;

// =============================================================================
// GSTR-2B Imports
// =============================================================================

export const gstr2bImportSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  document_id: z.string().uuid().nullable().optional(),
  return_period_fp: periodFpSchema,
  generated_on: z.string(),
  is_recompute: z.boolean().default(false),
  imported_by: z.string().uuid().nullable().optional(),
  record_count: z.number().int().nonnegative().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const gstr2bImportInsertSchema = gstr2bImportSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  is_recompute: z.boolean().default(false),
  record_count: z.number().int().nonnegative().default(0),
});

export const gstr2bImportUpdateSchema = gstr2bImportInsertSchema.partial();

export type Gstr2bImport = z.infer<typeof gstr2bImportSchema>;
export type Gstr2bImportInsert = z.infer<typeof gstr2bImportInsertSchema>;
export type Gstr2bImportUpdate = z.infer<typeof gstr2bImportUpdateSchema>;

// =============================================================================
// GSTR-2B Records
// =============================================================================

export const gstr2bRecordSchema = z.object({
  id: z.string().uuid(),
  import_id: z.string().uuid(),
  section: gstr2bSectionSchema.default('b2b'),
  supplier_gstin: gstinSchema,
  supplier_name: z.string().nullable().optional(),
  doc_no: z.string().min(1, 'Document number is required'),
  doc_no_norm: z.string().min(1, 'Normalized document number is required'),
  doc_date: z.string(),
  doc_type: z.string().default('INV'),
  taxable_value: z.number().default(0),
  cgst: z.number().default(0),
  sgst: z.number().default(0),
  igst: z.number().default(0),
  cess: z.number().default(0),
  itc_available: z.boolean().default(true),
  itc_reason: z.string().nullable().optional(),
  ims_action: imsActionSchema.default('none'),
  ims_action_at: z.string().nullable().optional(),
  ims_action_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const gstr2bRecordInsertSchema = gstr2bRecordSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  section: gstr2bSectionSchema.default('b2b'),
  doc_type: z.string().default('INV'),
  taxable_value: z.number().default(0),
  cgst: z.number().default(0),
  sgst: z.number().default(0),
  igst: z.number().default(0),
  cess: z.number().default(0),
  itc_available: z.boolean().default(true),
  ims_action: imsActionSchema.default('none'),
});

export const gstr2bRecordUpdateSchema = gstr2bRecordInsertSchema.partial();

export type Gstr2bRecord = z.infer<typeof gstr2bRecordSchema>;
export type Gstr2bRecordInsert = z.infer<typeof gstr2bRecordInsertSchema>;
export type Gstr2bRecordUpdate = z.infer<typeof gstr2bRecordUpdateSchema>;
