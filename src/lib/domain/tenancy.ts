import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const firmRoleSchema = z.enum(['admin', 'staff']);
export type FirmRole = z.infer<typeof firmRoleSchema>;

export const clientRoleSchema = z.enum(['owner', 'staff']);
export type ClientRole = z.infer<typeof clientRoleSchema>;

export const schemeSchema = z.enum([
  'regular',
  'qrmp',
  'composition',
  'unregistered',
]);
export type Scheme = z.infer<typeof schemeSchema>;

export const aatoBandSchema = z.enum([
  'below_40l',
  '40l_to_1_5cr',
  '1_5cr_to_5cr',
  'above_5cr',
]);
export type AatoBand = z.infer<typeof aatoBandSchema>;

export const langSchema = z.enum(['en', 'hi', 'mr']);
export type Lang = z.infer<typeof langSchema>;

// ============================================================================
// GSTIN & State Code Validators
// ============================================================================

/**
 * 15-character statutory GSTIN pattern:
 * - 2 digits state code (01-37, etc.)
 * - 5 uppercase letters (PAN alphabets)
 * - 4 digits (PAN sequence)
 * - 1 uppercase letter (PAN checksum character)
 * - 1 alphanumeric character (entity code: 1-9, A-Z)
 * - 'Z' (fixed default 14th character)
 * - 1 alphanumeric check digit
 */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const gstinSchema = z
  .string()
  .length(15, 'GSTIN must be exactly 15 characters')
  .regex(
    GSTIN_REGEX,
    'Invalid GSTIN format. Expected 15 characters: 2 state digits, 10-char PAN, 1 entity code, "Z", and 1 checksum char.'
  );
export type GSTIN = z.infer<typeof gstinSchema>;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin);
}

export const stateCodeSchema = z
  .string()
  .length(2, 'State code must be 2 digits')
  .regex(/^[0-9]{2}$/, 'State code must be a 2-digit number (e.g. "27" for Maharashtra)');
export type StateCode = z.infer<typeof stateCodeSchema>;

// ============================================================================
// 1. Firms
// ============================================================================

export const firmSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Firm name is required'),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type Firm = z.infer<typeof firmSchema>;

export const firmInsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Firm name is required'),
  created_by: z.string().uuid().nullable().optional(),
});
export type FirmInsert = z.infer<typeof firmInsertSchema>;

export const firmUpdateSchema = firmInsertSchema
  .omit({ id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type FirmUpdate = z.infer<typeof firmUpdateSchema>;

// ============================================================================
// 2. Firm Members
// ============================================================================

export const firmMemberSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: firmRoleSchema.default('staff'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type FirmMember = z.infer<typeof firmMemberSchema>;

export const firmMemberInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: firmRoleSchema.default('staff').optional(),
});
export type FirmMemberInsert = z.infer<typeof firmMemberInsertSchema>;

export const firmMemberUpdateSchema = z.object({
  role: firmRoleSchema.optional(),
  deleted_at: z.string().nullable().optional(),
});
export type FirmMemberUpdate = z.infer<typeof firmMemberUpdateSchema>;

// ============================================================================
// 3. Clients
// ============================================================================

export const clientSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  legal_name: z.string().min(1, 'Legal name is required'),
  trade_name: z.string().nullable().optional(),
  gstin: gstinSchema,
  state_code: stateCodeSchema,
  scheme: schemeSchema.default('regular'),
  aato_band: aatoBandSchema.default('below_40l'),
  fy_start_month: z.number().int().min(1).max(12).default(4),
  language: langSchema.default('en'),
  sells_exempt: z.boolean().default(false),
  sells_taxable: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type Client = z.infer<typeof clientSchema>;

export const clientInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  legal_name: z.string().min(1, 'Legal name is required'),
  trade_name: z.string().nullable().optional(),
  gstin: gstinSchema,
  state_code: stateCodeSchema,
  scheme: schemeSchema.default('regular').optional(),
  aato_band: aatoBandSchema.default('below_40l').optional(),
  fy_start_month: z.number().int().min(1).max(12).default(4).optional(),
  language: langSchema.default('en').optional(),
  sells_exempt: z.boolean().default(false).optional(),
  sells_taxable: z.boolean().default(true).optional(),
});
export type ClientInsert = z.infer<typeof clientInsertSchema>;

export const clientUpdateSchema = clientInsertSchema
  .omit({ id: true, firm_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;

// ============================================================================
// 4. Client Access
// ============================================================================

export const clientAccessSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: clientRoleSchema.default('staff'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type ClientAccess = z.infer<typeof clientAccessSchema>;

export const clientAccessInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: clientRoleSchema.default('staff').optional(),
});
export type ClientAccessInsert = z.infer<typeof clientAccessInsertSchema>;

export const clientAccessUpdateSchema = z.object({
  role: clientRoleSchema.optional(),
  deleted_at: z.string().nullable().optional(),
});
export type ClientAccessUpdate = z.infer<typeof clientAccessUpdateSchema>;

// ============================================================================
// 5. Platform Admins
// ============================================================================

export const platformAdminSchema = z.object({
  user_id: z.string().uuid(),
  created_at: z.string().optional(),
});
export type PlatformAdmin = z.infer<typeof platformAdminSchema>;

export const platformAdminInsertSchema = z.object({
  user_id: z.string().uuid(),
});
export type PlatformAdminInsert = z.infer<typeof platformAdminInsertSchema>;

export const platformAdminUpdateSchema = platformAdminInsertSchema.partial();
export type PlatformAdminUpdate = z.infer<typeof platformAdminUpdateSchema>;

// ============================================================================
// 6. Client Invites
// ============================================================================

export const clientInviteSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  token_hash: z.string().min(1, 'Token hash is required'),
  expires_at: z.string(),
  accepted_by: z.string().uuid().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type ClientInvite = z.infer<typeof clientInviteSchema>;

export const clientInviteInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  token_hash: z.string().min(1, 'Token hash is required'),
  expires_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
});
export type ClientInviteInsert = z.infer<typeof clientInviteInsertSchema>;

export const clientInviteUpdateSchema = z.object({
  accepted_by: z.string().uuid().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type ClientInviteUpdate = z.infer<typeof clientInviteUpdateSchema>;

