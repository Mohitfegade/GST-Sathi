import { z } from 'zod';
import { gstinSchema } from './tenancy';
import { periodFpSchema } from './documents';

// ============================================================================
// Enums
// ============================================================================

export const invStatusSchema = z.enum([
  'draft',
  'needs_review',
  'approved',
  'rejected',
]);
export type InvStatus = z.infer<typeof invStatusSchema>;

export const invSourceSchema = z.enum(['extracted', 'manual', 'imported']);
export type InvSource = z.infer<typeof invSourceSchema>;

export const itcStateSchema = z.enum([
  'eligible',
  'ineligible',
  'blocked',
  'pending',
]);
export type ItcState = z.infer<typeof itcStateSchema>;

export const filingStatusSchema = z.enum([
  'unknown',
  'filed',
  'not_filed',
  'cancelled',
]);
export type FilingStatus = z.infer<typeof filingStatusSchema>;

export const payModeSchema = z.enum(['cash', 'upi', 'bank', 'other']);
export type PayMode = z.infer<typeof payModeSchema>;

export const rateStatusSchema = z.enum(['ok', 'mismatch', 'unknown']);
export type RateStatus = z.infer<typeof rateStatusSchema>;

// ============================================================================
// Money & Numeric (14, 2) Precision Schemas
// ============================================================================

/**
 * Validates monetary and decimal values with numeric(14,2) precision.
 * Accepts numbers or strings with at most 2 decimal places (both positive and negative for round_off).
 */
export const moneySchema = z.union([
  z.number(),
  z
    .string()
    .trim()
    .regex(
      /^-?\d+(\.\d{1,2})?$/,
      'Must be a valid numeric amount with at most 2 decimal places'
    ),
]);
export type Money = z.infer<typeof moneySchema>;

/**
 * Alias for numeric(14,2) precision fields.
 */
export const numeric14_2Schema = moneySchema;

/**
 * Validates quantity with up to numeric(12,3) precision (e.g., 1.500 KG or 1 NOS).
 */
export const quantitySchema = z.union([
  z.number(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must have at most 3 decimal places'),
]);
export type Quantity = z.infer<typeof quantitySchema>;

/**
 * Validates GST rate percentage (e.g., 0, 5, 12, 18, 28) with up to 2 decimal places.
 */
export const taxRateSchema = z.union([
  z.number().min(0).max(100),
  z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      'Tax rate must be a valid percentage with at most 2 decimal places'
    ),
]);
export type TaxRate = z.infer<typeof taxRateSchema>;

/**
 * Normalizes an invoice number by removing whitespace, hyphens, and slashes,
 * and converting to uppercase for deterministic reconciliation matching.
 */
export function normalizeInvoiceNo(invoiceNo: string): string {
  return invoiceNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// ============================================================================
// 1. Suppliers
// ============================================================================

export const supplierSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  gstin: gstinSchema.nullable().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  filing_status: filingStatusSchema.default('unknown'),
  last_checked_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const supplierInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  gstin: gstinSchema.nullable().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  filing_status: filingStatusSchema.default('unknown').optional(),
  last_checked_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type SupplierInsert = z.infer<typeof supplierInsertSchema>;

export const supplierUpdateSchema = supplierInsertSchema
  .omit({ id: true, firm_id: true, client_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>;

// ============================================================================
// 2. Invoices (Purchase Bills)
// ============================================================================

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable().optional(),
  document_id: z.string().uuid().nullable().optional(),
  invoice_no: z.string().min(1, 'invoice_no is required'),
  invoice_no_norm: z.string().min(1, 'invoice_no_norm is required'),
  invoice_date: z.string().min(1, 'invoice_date is required'),
  place_of_supply: z
    .string()
    .length(2, 'place_of_supply must be 2 digits')
    .regex(/^[0-9]{2}$/, 'place_of_supply must consist of 2 numeric digits'),
  taxable_value: moneySchema.default(0),
  cgst: moneySchema.default(0),
  sgst: moneySchema.default(0),
  igst: moneySchema.default(0),
  cess: moneySchema.default(0),
  round_off: moneySchema.default(0),
  total: moneySchema,
  status: invStatusSchema.default('draft'),
  source: invSourceSchema.default('extracted'),
  itc_state: itcStateSchema.default('eligible'),
  period_fp: periodFpSchema,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceInsertSchema = z.object({
  id: z.string().uuid().optional(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable().optional(),
  document_id: z.string().uuid().nullable().optional(),
  invoice_no: z.string().min(1, 'invoice_no is required'),
  invoice_no_norm: z.string().min(1).optional(),
  invoice_date: z.string().min(1, 'invoice_date is required'),
  place_of_supply: z
    .string()
    .length(2, 'place_of_supply must be 2 digits')
    .regex(/^[0-9]{2}$/, 'place_of_supply must consist of 2 numeric digits'),
  taxable_value: moneySchema.default(0).optional(),
  cgst: moneySchema.default(0).optional(),
  sgst: moneySchema.default(0).optional(),
  igst: moneySchema.default(0).optional(),
  cess: moneySchema.default(0).optional(),
  round_off: moneySchema.default(0).optional(),
  total: moneySchema,
  status: invStatusSchema.default('draft').optional(),
  source: invSourceSchema.default('extracted').optional(),
  itc_state: itcStateSchema.default('eligible').optional(),
  period_fp: periodFpSchema,
});
export type InvoiceInsert = z.infer<typeof invoiceInsertSchema>;

export const invoiceUpdateSchema = invoiceInsertSchema
  .omit({ id: true, firm_id: true, client_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type InvoiceUpdate = z.infer<typeof invoiceUpdateSchema>;

// ============================================================================
// 3. Invoice Lines
// ============================================================================

export const invoiceLineSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  line_no: z.number().int().positive('line_no must be positive'),
  description: z.string().default(''),
  hsn: z
    .string()
    .regex(/^[0-9]{2,8}$/, 'HSN must be 2 to 8 numeric digits')
    .nullable()
    .optional(),
  qty: quantitySchema.default(1),
  unit: z.string().default('NOS'),
  unit_price: moneySchema.default(0),
  taxable_value: moneySchema.default(0),
  tax_rate: taxRateSchema.default(0),
  cgst: moneySchema.default(0),
  sgst: moneySchema.default(0),
  igst: moneySchema.default(0),
  cess: moneySchema.default(0),
  rate_rule_id: z.string().uuid().nullable().optional(),
  rate_status: rateStatusSchema.default('unknown'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceLineInsertSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_id: z.string().uuid(),
  line_no: z.number().int().positive('line_no must be positive'),
  description: z.string().default('').optional(),
  hsn: z
    .string()
    .regex(/^[0-9]{2,8}$/, 'HSN must be 2 to 8 numeric digits')
    .nullable()
    .optional(),
  qty: quantitySchema.default(1).optional(),
  unit: z.string().default('NOS').optional(),
  unit_price: moneySchema.default(0).optional(),
  taxable_value: moneySchema.default(0).optional(),
  tax_rate: taxRateSchema.default(0).optional(),
  cgst: moneySchema.default(0).optional(),
  sgst: moneySchema.default(0).optional(),
  igst: moneySchema.default(0).optional(),
  cess: moneySchema.default(0).optional(),
  rate_rule_id: z.string().uuid().nullable().optional(),
  rate_status: rateStatusSchema.default('unknown').optional(),
});
export type InvoiceLineInsert = z.infer<typeof invoiceLineInsertSchema>;

export const invoiceLineUpdateSchema = invoiceLineInsertSchema
  .omit({ id: true, invoice_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type InvoiceLineUpdate = z.infer<typeof invoiceLineUpdateSchema>;

// ============================================================================
// 4. Invoice Payments
// ============================================================================

export const invoicePaymentSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  paid_on: z.string().min(1, 'paid_on date is required'),
  amount: moneySchema,
  mode: payModeSchema.default('bank'),
  reference_no: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});
export type InvoicePayment = z.infer<typeof invoicePaymentSchema>;

export const invoicePaymentInsertSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_id: z.string().uuid(),
  paid_on: z.string().min(1, 'paid_on date is required'),
  amount: moneySchema,
  mode: payModeSchema.default('bank').optional(),
  reference_no: z.string().nullable().optional(),
});
export type InvoicePaymentInsert = z.infer<typeof invoicePaymentInsertSchema>;

export const invoicePaymentUpdateSchema = invoicePaymentInsertSchema
  .omit({ id: true, invoice_id: true })
  .partial()
  .extend({
    deleted_at: z.string().nullable().optional(),
  });
export type InvoicePaymentUpdate = z.infer<typeof invoicePaymentUpdateSchema>;
