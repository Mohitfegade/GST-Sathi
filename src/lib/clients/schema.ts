import { z } from 'zod';
import {
  schemeSchema,
  aatoBandSchema,
  langSchema,
} from '@/lib/domain/tenancy';
import { validateGstin } from '@/lib/gst/gstin';
import { CLIENT_MESSAGES } from './messages';

/**
 * Zod validation schema for SME client form inputs.
 *
 * Rules:
 * - Legal name: required, non-empty after trimming.
 * - Trade name: optional, trimmed, converted to undefined when empty.
 * - GSTIN: required, must be uppercase, 15 chars, valid Luhn mod-36 checksum.
 * - Scheme: valid scheme enum, defaults to 'regular'.
 * - AATO band: valid turnover band enum, defaults to 'below_40l'.
 * - Selling types: at least one of sells_exempt or sells_taxable must be true.
 * - Language: preferred language enum, defaults to 'en'.
 */
export const clientFormSchema = z
  .object({
    legal_name: z
      .string()
      .trim()
      .min(1, CLIENT_MESSAGES.errors.nameRequired),
    trade_name: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    gstin: z
      .string()
      .trim(),
    scheme: schemeSchema.default('regular'),
    aato_band: aatoBandSchema.default('below_40l'),
    sells_exempt: z.boolean().default(false),
    sells_taxable: z.boolean().default(true),
    language: langSchema.default('en'),
  })
  .superRefine((data, ctx) => {
    // 1. GSTIN non-empty check
    if (!data.gstin || data.gstin.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: CLIENT_MESSAGES.errors.gstinRequired,
        path: ['gstin'],
      });
      return;
    }

    // 2. GSTIN must be uppercase
    if (data.gstin !== data.gstin.toUpperCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: CLIENT_MESSAGES.errors.gstinInvalid,
        path: ['gstin'],
      });
      return;
    }

    // 3. GSTIN format and Luhn mod-36 checksum validation
    const gstinResult = validateGstin(data.gstin);
    if (!gstinResult.valid) {
      const isChecksumError = gstinResult.error?.toLowerCase().includes('checksum');
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isChecksumError
          ? CLIENT_MESSAGES.errors.gstinChecksumFailed
          : CLIENT_MESSAGES.errors.gstinInvalid,
        path: ['gstin'],
      });
    }

    // 4. Selling types check: at least one of sells_exempt or sells_taxable must be true
    if (!data.sells_exempt && !data.sells_taxable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: CLIENT_MESSAGES.errors.sellingTypeRequired,
        path: ['sells_taxable'],
      });
    }
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;
