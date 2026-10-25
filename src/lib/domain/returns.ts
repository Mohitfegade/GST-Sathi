import { z } from 'zod';
import { periodFpSchema } from './documents';

// =============================================================================
// Enums
// =============================================================================

export const returnTypeSchema = z.enum(['gstr1', 'gstr3b', 'cmp08', 'gstr4']);
export type ReturnType = z.infer<typeof returnTypeSchema>;

export const returnStatusSchema = z.enum([
  'not_started',
  'draft',
  'in_review',
  'approved',
  'filed',
]);
export type ReturnStatus = z.infer<typeof returnStatusSchema>;

// =============================================================================
// Return Periods
// =============================================================================

export const returnPeriodSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  return_type: returnTypeSchema,
  fp: periodFpSchema,
  due_date: z.string(),
  status: returnStatusSchema.default('not_started'),
  filed_on: z.string().nullable().optional(),
  ack_ref: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const returnPeriodInsertSchema = returnPeriodSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: z.string().uuid().optional(),
  status: returnStatusSchema.default('not_started'),
});

export const returnPeriodUpdateSchema = returnPeriodInsertSchema.partial();

export type ReturnPeriod = z.infer<typeof returnPeriodSchema>;
export type ReturnPeriodInsert = z.infer<typeof returnPeriodInsertSchema>;
export type ReturnPeriodUpdate = z.infer<typeof returnPeriodUpdateSchema>;

// =============================================================================
// Return Drafts
// =============================================================================

export const returnDraftSchema = z.object({
  id: z.string().uuid(),
  return_period_id: z.string().uuid(),
  version: z.number().int().min(1).default(1),
  payload: z.record(z.string(), z.unknown()),
  rule_snapshot_id: z.string().uuid().nullable().optional(),
  created_by: z.string().uuid(),
  approved_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
});

export const returnDraftInsertSchema = returnDraftSchema.omit({
  id: true,
  created_at: true,
}).extend({
  id: z.string().uuid().optional(),
  version: z.number().int().min(1).default(1),
});

export const returnDraftUpdateSchema = returnDraftInsertSchema.partial();

export type ReturnDraft = z.infer<typeof returnDraftSchema>;
export type ReturnDraftInsert = z.infer<typeof returnDraftInsertSchema>;
export type ReturnDraftUpdate = z.infer<typeof returnDraftUpdateSchema>;
