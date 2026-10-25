import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

export const alertKindSchema = z.enum([
  'deadline',
  'itc_at_risk',
  'threshold',
  'missing_docs',
  'rule_change',
  'late_fee',
]);
export type AlertKind = z.infer<typeof alertKindSchema>;

export const severitySchema = z.enum(['info', 'warn', 'urgent']);
export type Severity = z.infer<typeof severitySchema>;

export const alertStatusSchema = z.enum(['open', 'dismissed', 'done']);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

// =============================================================================
// Audit Events (Append-Only Statutory Ledger)
// =============================================================================

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  actor_id: z.string().uuid().nullable().optional(),
  action: z.string().min(1, 'Action is required'),
  entity: z.string().min(1, 'Entity is required'),
  entity_id: z.string().uuid(),
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
});

export const auditEventInsertSchema = auditEventSchema.omit({
  id: true,
  created_at: true,
}).extend({
  id: z.string().uuid().optional(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventInsert = z.infer<typeof auditEventInsertSchema>;

// =============================================================================
// Alerts
// =============================================================================

export const alertSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  kind: alertKindSchema,
  severity: severitySchema.default('info'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  due_date: z.string().nullable().optional(),
  status: alertStatusSchema.default('open'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const alertInsertSchema = alertSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: z.string().uuid().optional(),
  severity: severitySchema.default('info'),
  status: alertStatusSchema.default('open'),
});

export const alertUpdateSchema = alertInsertSchema.partial();

export type Alert = z.infer<typeof alertSchema>;
export type AlertInsert = z.infer<typeof alertInsertSchema>;
export type AlertUpdate = z.infer<typeof alertUpdateSchema>;
