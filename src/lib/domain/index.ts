/**
 * GST Saathi Domain Models
 *
 * Central export of all Zod schemas, inferred TypeScript types,
 * constants, and validation helpers across the entire domain model.
 */

// Tenancy & Identity
export * from './tenancy';

// Documents & Storage
export * from './documents';

// Purchases & Invoicing
export * from './purchases';

// Extraction & OCR
export * from './extraction';

// GSTR-2B & IMS
export * from './gstr2b';

// Reconciliation Engine
export * from './reconciliation';

// Sales & Accounts Receivable
export * from './sales';

// Statutory Returns & Filings
export * from './returns';

// Regulatory Tax Rules & Snapshots
export * from './rules';

// Compliance Alerts & Immutable Audit Trail
export * from './audit';
