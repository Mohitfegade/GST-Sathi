/**
 * Parsed components of a document storage path.
 */
export interface ParsedDocumentStoragePath {
  firmId: string;
  clientId: string;
  documentId: string;
}

/**
 * Standard RFC 4122 UUID regex (case-insensitive, 8-4-4-4-12 hex characters).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if a string is a valid UUID.
 */
export function isValidUuid(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
}

/**
 * Builds the canonical document storage path in the Supabase private bucket.
 * Follows the layout: `${firmId}/${clientId}/${documentId}`
 *
 * @param firmId Firm UUID
 * @param clientId Client UUID
 * @param documentId Document UUID
 * @returns Storage object path
 */
export function buildDocumentStoragePath(
  firmId: string,
  clientId: string,
  documentId: string
): string {
  const f = (firmId ?? '').trim().replace(/^\/+|\/+$/g, '');
  const c = (clientId ?? '').trim().replace(/^\/+|\/+$/g, '');
  const d = (documentId ?? '').trim().replace(/^\/+|\/+$/g, '');

  if (!f || !c || !d) {
    throw new Error('firmId, clientId, and documentId are all required to build a storage path');
  }

  return `${f}/${c}/${d}`;
}

/**
 * Parses and validates a document storage path.
 * Verifies that the path consists of exactly 3 valid UUID segments: firmId, clientId, and documentId.
 *
 * @param path Storage path string
 * @returns Parsed segments object, or null if invalid
 */
export function parseDocumentStoragePath(
  path: string
): ParsedDocumentStoragePath | null {
  if (typeof path !== 'string') {
    return null;
  }

  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }

  // Reject consecutive slashes (empty segments)
  if (trimmed.includes('//')) {
    return null;
  }

  // Strip single leading and trailing slash if present
  const cleanPath = trimmed.replace(/^\//, '').replace(/\/$/, '');
  const segments = cleanPath.split('/');

  if (segments.length !== 3) {
    return null;
  }

  const [firmId, clientId, documentId] = segments;

  if (
    !isValidUuid(firmId) ||
    !isValidUuid(clientId) ||
    !isValidUuid(documentId)
  ) {
    return null;
  }

  return {
    firmId,
    clientId,
    documentId,
  };
}
