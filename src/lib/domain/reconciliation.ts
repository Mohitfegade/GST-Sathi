import { z } from 'zod';
import { periodFpSchema } from './documents';

// =============================================================================
// Enums
// =============================================================================

export const reconStatusSchema = z.enum([
  'matched',
  'fuzzy_match',
  'period_shift',
  'missing_in_2b',
  'missing_in_books',
  'mismatch',
]);
export type ReconStatus = z.infer<typeof reconStatusSchema>;

export const userDecisionSchema = z.enum(['none', 'accepted', 'disputed', 'ignored']);
export type UserDecision = z.infer<typeof userDecisionSchema>;

// =============================================================================
// Reconciliation Runs
// =============================================================================

export const reconciliationRunSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  period_fp: periodFpSchema,
  import_id: z.string().uuid().nullable().optional(),
  status: z.string().default('started'),
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
  summary: z.record(z.string(), z.unknown()).nullable().optional(),
  rule_snapshot_id: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const reconciliationRunInsertSchema = reconciliationRunSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  status: z.string().default('started'),
  started_at: z.string().optional(),
});

export const reconciliationRunUpdateSchema = reconciliationRunInsertSchema.partial();

export type ReconciliationRun = z.infer<typeof reconciliationRunSchema>;
export type ReconciliationRunInsert = z.infer<typeof reconciliationRunInsertSchema>;
export type ReconciliationRunUpdate = z.infer<typeof reconciliationRunUpdateSchema>;

// =============================================================================
// Reconciliation Results
// =============================================================================

export const reconciliationResultSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  gstr2b_record_id: z.string().uuid().nullable().optional(),
  status: reconStatusSchema,
  match_pass: z.number().int().min(1).max(4).default(1),
  diff_taxable: z.number().default(0),
  diff_tax: z.number().default(0),
  itc_at_risk: z.number().default(0),
  user_decision: userDecisionSchema.default('none'),
  decided_by: z.string().uuid().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const reconciliationResultInsertSchema = reconciliationResultSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  match_pass: z.number().int().min(1).max(4).default(1),
  diff_taxable: z.number().default(0),
  diff_tax: z.number().default(0),
  itc_at_risk: z.number().default(0),
  user_decision: userDecisionSchema.default('none'),
});

export const reconciliationResultUpdateSchema = reconciliationResultInsertSchema.partial();

export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;
export type ReconciliationResultInsert = z.infer<typeof reconciliationResultInsertSchema>;
export type ReconciliationResultUpdate = z.infer<typeof reconciliationResultUpdateSchema>;
