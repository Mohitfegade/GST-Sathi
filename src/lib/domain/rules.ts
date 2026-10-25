import { z } from 'zod';

// =============================================================================
// Rule Snapshots
// =============================================================================

export const ruleSnapshotSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  checksum: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'Checksum must be a 64-character lowercase hex string'),
  created_at: z.string().optional(),
});

export const ruleSnapshotInsertSchema = ruleSnapshotSchema.omit({
  id: true,
  created_at: true,
}).extend({
  id: z.string().uuid().optional(),
});

export const ruleSnapshotUpdateSchema = ruleSnapshotInsertSchema.partial();

export type RuleSnapshot = z.infer<typeof ruleSnapshotSchema>;
export type RuleSnapshotInsert = z.infer<typeof ruleSnapshotInsertSchema>;
export type RuleSnapshotUpdate = z.infer<typeof ruleSnapshotUpdateSchema>;

// =============================================================================
// GST Rate Rules
// =============================================================================

export const gstRateRuleSchema = z.object({
  id: z.string().uuid(),
  hsn_prefix: z.string().regex(/^[0-9]{2,8}$/, 'HSN prefix must be 2 to 8 digits'),
  description_pattern: z.string().nullable().optional(),
  rate: z.number().min(0).max(100, 'Rate must be between 0 and 100'),
  effective_from: z.string(),
  effective_to: z.string().nullable().optional(),
  source_ref: z.string().min(1, 'Source reference is required'),
  verified_by_ca: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const gstRateRuleInsertSchema = gstRateRuleSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  verified_by_ca: z.boolean().default(false),
});

export const gstRateRuleUpdateSchema = gstRateRuleInsertSchema.partial();

export type GstRateRule = z.infer<typeof gstRateRuleSchema>;
export type GstRateRuleInsert = z.infer<typeof gstRateRuleInsertSchema>;
export type GstRateRuleUpdate = z.infer<typeof gstRateRuleUpdateSchema>;

// =============================================================================
// Rule Params
// =============================================================================

export const ruleParamSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1, 'Key is required'),
  value: z.unknown(),
  effective_from: z.string(),
  effective_to: z.string().nullable().optional(),
  source_ref: z.string().min(1, 'Source reference is required'),
  verified_by_ca: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export const ruleParamInsertSchema = ruleParamSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  id: z.string().uuid().optional(),
  verified_by_ca: z.boolean().default(false),
});

export const ruleParamUpdateSchema = ruleParamInsertSchema.partial();

export type RuleParam = z.infer<typeof ruleParamSchema>;
export type RuleParamInsert = z.infer<typeof ruleParamInsertSchema>;
export type RuleParamUpdate = z.infer<typeof ruleParamUpdateSchema>;
