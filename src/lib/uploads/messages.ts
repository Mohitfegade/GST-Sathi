/**
 * Plain-English upload and document messages for non-technical users.
 * Avoids engineering jargon (e.g. hash collisions, MIME errors, status codes)
 * in favor of empathetic, actionable guidance for business owners.
 */

export const DUPLICATE_MESSAGE = 'You already sent this bill';
export const UNSUPPORTED_FORMAT_MESSAGE =
  'We can only accept photo bills (JPEG, PNG, WebP) or PDF documents. Please take a clear photo or pick a PDF.';
export const FILE_TOO_LARGE_MESSAGE =
  'This file is larger than 10 MB. Please send a smaller photo or document.';
export const BATCH_TOO_LARGE_MESSAGE =
  'You can send up to 20 bills at a time. Please select fewer bills and try again.';
export const RATE_LIMIT_MESSAGE =
  'You have reached the upload limit for this hour (100 files). Please wait a while before sending more bills.';
export const QUOTA_EXCEEDED_MESSAGE = RATE_LIMIT_MESSAGE;
export const NETWORK_OFFLINE_MESSAGE =
  'You are currently offline. Sending will resume as soon as you are reconnected.';
export const UPLOAD_FAILURE_MESSAGE =
  'Could not send this bill. Please tap Retry or choose the file again.';
export const CONFIRM_FAILURE_MESSAGE =
  'The file could not be verified. Please check the file and try again.';
export const DELETE_CONFIRMATION_MESSAGE =
  "Hide this bill? It will be removed from this client's list.";
export const EMPTY_LIST_MESSAGE =
  'No bills yet. Tap Add bills to send your first one.';

/**
 * Map of message keys to user-facing strings.
 */
export const UPLOAD_MESSAGES = {
  duplicate: DUPLICATE_MESSAGE,
  duplicates: DUPLICATE_MESSAGE,
  unsupportedFormat: UNSUPPORTED_FORMAT_MESSAGE,
  unsupported_format: UNSUPPORTED_FORMAT_MESSAGE,
  fileTooLarge: FILE_TOO_LARGE_MESSAGE,
  file_too_large: FILE_TOO_LARGE_MESSAGE,
  batchTooLarge: BATCH_TOO_LARGE_MESSAGE,
  batch_too_large: BATCH_TOO_LARGE_MESSAGE,
  rateLimit: RATE_LIMIT_MESSAGE,
  rate_limit: RATE_LIMIT_MESSAGE,
  quotaExceeded: QUOTA_EXCEEDED_MESSAGE,
  quota_exceeded: QUOTA_EXCEEDED_MESSAGE,
  networkOffline: NETWORK_OFFLINE_MESSAGE,
  network_offline: NETWORK_OFFLINE_MESSAGE,
  uploadFailure: UPLOAD_FAILURE_MESSAGE,
  upload_failure: UPLOAD_FAILURE_MESSAGE,
  confirmFailure: CONFIRM_FAILURE_MESSAGE,
  confirm_failure: CONFIRM_FAILURE_MESSAGE,
  deleteConfirmation: DELETE_CONFIRMATION_MESSAGE,
  delete_confirmation: DELETE_CONFIRMATION_MESSAGE,
  emptyList: EMPTY_LIST_MESSAGE,
  empty_list: EMPTY_LIST_MESSAGE,
} as const;

export type UploadMessageKey = keyof typeof UPLOAD_MESSAGES;

/**
 * Returns the plain-English message for the specified key.
 */
export function getUploadMessage(key: UploadMessageKey): string {
  return UPLOAD_MESSAGES[key];
}

/**
 * Resolves standard error messages or error codes into plain-English friendly copy.
 */
export function resolveUploadErrorMessage(error: string | Error | null | undefined): string {
  if (!error) return UPLOAD_FAILURE_MESSAGE;
  const msg = typeof error === 'string' ? error : error.message;
  const lower = msg.toLowerCase();

  if (
    lower.includes('duplicate') ||
    lower.includes('already sent') ||
    lower.includes('sha256') ||
    lower.includes('unique_client_sha256')
  ) {
    return DUPLICATE_MESSAGE;
  }
  if (
    lower.includes('format') ||
    lower.includes('mime') ||
    lower.includes('extension') ||
    lower.includes('unsupported')
  ) {
    return UNSUPPORTED_FORMAT_MESSAGE;
  }
  if (
    lower.includes('large') ||
    lower.includes('size') ||
    lower.includes('10 mb') ||
    lower.includes('413')
  ) {
    return FILE_TOO_LARGE_MESSAGE;
  }
  if (lower.includes('batch') || lower.includes('20')) {
    return BATCH_TOO_LARGE_MESSAGE;
  }
  if (
    lower.includes('rate') ||
    lower.includes('limit') ||
    lower.includes('quota') ||
    lower.includes('429') ||
    lower.includes('100 files')
  ) {
    return RATE_LIMIT_MESSAGE;
  }
  if (lower.includes('offline') || lower.includes('network') || lower.includes('failed to fetch')) {
    return NETWORK_OFFLINE_MESSAGE;
  }
  if (lower.includes('confirm') || lower.includes('verif')) {
    return CONFIRM_FAILURE_MESSAGE;
  }

  return UPLOAD_FAILURE_MESSAGE;
}
