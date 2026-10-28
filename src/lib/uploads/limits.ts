/**
 * Upload constraints and limits for purchase-bill and document uploads.
 */

/** Max file size: 10 MB in bytes */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum number of files permitted in a single upload batch */
export const MAX_FILES_PER_BATCH = 20;

/** Rate limit: maximum number of uploads allowed per client per hour */
export const MAX_UPLOADS_PER_CLIENT_PER_HOUR = 100;

/** Allowed MIME types for uploaded purchase bills */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'] as const;

/** Browser-side image downscaling max dimension for the longest edge */
export const IMAGE_DOWNSCALE_MAX_EDGE = 2000;

/** Browser-side image downscaling JPEG compression quality (0.0 to 1.0) */
export const IMAGE_DOWNSCALE_QUALITY = 0.85;

/** Expiry duration for signed preview/download URLs in seconds (5 minutes) */
export const PREVIEW_URL_EXPIRY_SECONDS = 300;

/** Stale upload timeout in hours (unconfirmed 'uploaded' status rows) */
export const STALE_UPLOAD_TIMEOUT_HOURS = 1;

/** Maximum concurrent uploads in browser queue */
export const CONCURRENT_UPLOADS_LIMIT = 3;

/** Polling interval for document status updates in milliseconds (5 seconds) */
export const POLLING_INTERVAL_MS = 5000;

/** Supabase storage bucket name for private document storage */
export const STORAGE_BUCKET = 'documents';
