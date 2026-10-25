import { z } from 'zod';

// ============================================================================
// Bounding Box & Confidence Schemas
// ============================================================================

/**
 * 2D normalized or pixel-space bounding box coordinates of an extracted token or field.
 * x: horizontal offset
 * y: vertical offset
 * w: bounding box width
 * h: bounding box height
 * page: optional page number (1-indexed) in multi-page documents
 */
export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  page: z.number().int().positive().optional(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

/**
 * OCR / Vision LLM confidence score between 0.000 and 1.000 (numeric(4,3)).
 * Accepts numbers or strings with at most 3 decimal places.
 */
export const confidenceSchema = z.union([
  z.number().min(0).max(1),
  z
    .string()
    .trim()
    .regex(
      /^(0(\.\d{1,3})?|1(\.0{1,3})?)$/,
      'Confidence must be between 0.000 and 1.000 with at most 3 decimal places'
    ),
]);
export type Confidence = z.infer<typeof confidenceSchema>;

// ============================================================================
// Extraction Fields
// ============================================================================

export const extractionFieldSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  field_path: z.string().min(1, 'field_path is required (e.g., "header.invoice_no")'),
  ai_initial_value: z.string().nullable().optional(),
  confidence: confidenceSchema.nullable().optional(),
  bbox: boundingBoxSchema.nullable().optional(),
  final_value: z.string().nullable().optional(),
  modified_by: z.string().uuid().nullable().optional(),
  modified_at: z.string().nullable().optional(),
  model_version: z.string().min(1, 'model_version is required'),
  rule_snapshot_id: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
});
export type ExtractionField = z.infer<typeof extractionFieldSchema>;

export const extractionFieldInsertSchema = z.object({
  id: z.string().uuid().optional(),
  document_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  field_path: z.string().min(1, 'field_path is required'),
  ai_initial_value: z.string().nullable().optional(),
  confidence: confidenceSchema.nullable().optional(),
  bbox: boundingBoxSchema.nullable().optional(),
  final_value: z.string().nullable().optional(),
  modified_by: z.string().uuid().nullable().optional(),
  modified_at: z.string().nullable().optional(),
  model_version: z.string().min(1, 'model_version is required'),
  rule_snapshot_id: z.string().uuid().nullable().optional(),
});
export type ExtractionFieldInsert = z.infer<typeof extractionFieldInsertSchema>;

export const extractionFieldUpdateSchema = extractionFieldInsertSchema
  .omit({ id: true, document_id: true })
  .partial();
export type ExtractionFieldUpdate = z.infer<typeof extractionFieldUpdateSchema>;
