import { z } from 'zod';
import { gstinSchema, stateCodeSchema } from './tenancy';
import { invStatusSchema } from './purchases';

// =============================================================================
// Enums
// =============================================================================

export const salesSourceSchema = z.enum(['manual', 'csv', 'upi_statement']);
export type SalesSource = z.infer<typeof salesSourceSchema>;

export const salesDocTypeSchema = z.enum([
  'tax_invoice',
  'bill_of_supply',
  'invoice_cum_bos',
  'credit_note',
  'debit_note',
]);
export type SalesDocType = z.infer<typeof salesDocTypeSchema>;

// =============================================================================
// Sales Entries
// =============================================================================

export const salesEntrySchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  entry_date: z.string(),
  cash_total: z.number().nonnegative().default(0),
  upi_total: z.number().nonnegative().default(0),
  taxable_sales: z.number().nonnegative().default(0),
  exempt_sales: z.number().nonnegative().default(0),
  source: salesSourceSchema.default('manual'),
  document_id: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const salesEntryInsertSchema = salesEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: z.string().uuid().optional(),
  cash_total: z.number().nonnegative().default(0),
  upi_total: z.number().nonnegative().default(0),
  taxable_sales: z.number().nonnegative().default(0),
  exempt_sales: z.number().nonnegative().default(0),
  source: salesSourceSchema.default('manual'),
});

export const salesEntryUpdateSchema = salesEntryInsertSchema.partial();

export type SalesEntry = z.infer<typeof salesEntrySchema>;
export type SalesEntryInsert = z.infer<typeof salesEntryInsertSchema>;
export type SalesEntryUpdate = z.infer<typeof salesEntryUpdateSchema>;

// =============================================================================
// Sales Invoices
// =============================================================================

export const salesInvoiceSchema = z.object({
  id: z.string().uuid(),
  firm_id: z.string().uuid(),
  client_id: z.string().uuid(),
  invoice_no: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string(),
  buyer_gstin: gstinSchema.nullable().optional(),
  buyer_name: z.string().nullable().optional(),
  place_of_supply: stateCodeSchema,
  taxable_value: z.number().nonnegative().default(0),
  cgst: z.number().nonnegative().default(0),
  sgst: z.number().nonnegative().default(0),
  igst: z.number().nonnegative().default(0),
  cess: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  doc_type: salesDocTypeSchema.default('tax_invoice'),
  status: invStatusSchema.default('approved'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const salesInvoiceInsertSchema = salesInvoiceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: z.string().uuid().optional(),
  taxable_value: z.number().nonnegative().default(0),
  cgst: z.number().nonnegative().default(0),
  sgst: z.number().nonnegative().default(0),
  igst: z.number().nonnegative().default(0),
  cess: z.number().nonnegative().default(0),
  doc_type: salesDocTypeSchema.default('tax_invoice'),
  status: invStatusSchema.default('approved'),
});

export const salesInvoiceUpdateSchema = salesInvoiceInsertSchema.partial();

export type SalesInvoice = z.infer<typeof salesInvoiceSchema>;
export type SalesInvoiceInsert = z.infer<typeof salesInvoiceInsertSchema>;
export type SalesInvoiceUpdate = z.infer<typeof salesInvoiceUpdateSchema>;
