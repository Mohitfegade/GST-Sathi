import type { AllowedMimeType } from './limits';

/**
 * Result of validating document bytes against allowed MIME types.
 */
export interface DocumentByteValidationResult {
  valid: boolean;
  detectedMime: AllowedMimeType | null;
}

/**
 * Converts input bytes to a Uint8Array view without copying unless necessary.
 */
function toUint8Array(
  input: Uint8Array | ArrayBuffer | Buffer | null | undefined
): Uint8Array | null {
  if (!input) {
    return null;
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

/**
 * Sniffs first bytes (magic numbers) of the provided buffer to detect MIME type.
 * Supported document formats:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (bytes 0-3: 52 49 46 46) + WEBP (bytes 8-11: 57 45 42 50)
 * - PDF: %PDF- (bytes 0-4: 25 50 44 46 2D)
 *
 * @param bytes Buffer, Uint8Array, or ArrayBuffer of the file
 * @returns Detected AllowedMimeType or null if unrecognized
 */
export function sniffMimeType(
  bytes: Uint8Array | ArrayBuffer | Buffer
): AllowedMimeType | null {
  const u8 = toUint8Array(bytes);
  if (!u8 || u8.length < 3) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return 'image/jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
  if (
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47 &&
    u8[4] === 0x0d &&
    u8[5] === 0x0a &&
    u8[6] === 0x1a &&
    u8[7] === 0x0a
  ) {
    return 'image/png';
  }

  // 3. PDF: %PDF- (bytes 0-4: 25 50 44 46 2D)
  if (
    u8.length >= 5 &&
    u8[0] === 0x25 &&
    u8[1] === 0x50 &&
    u8[2] === 0x44 &&
    u8[3] === 0x46 &&
    u8[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // 4. WebP: RIFF (bytes 0-3: 52 49 46 46) + WEBP (bytes 8-11: 57 45 42 50)
  if (
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates document bytes and optionally checks if the detected MIME matches
 * the expected MIME type.
 *
 * @param bytes File data bytes
 * @param expectedMimeType Optional expected MIME type (e.g. 'image/jpeg', 'application/pdf')
 * @returns { valid: boolean, detectedMime: AllowedMimeType | null }
 */
export function isValidDocumentBytes(
  bytes: Uint8Array | ArrayBuffer | Buffer,
  expectedMimeType?: string
): DocumentByteValidationResult {
  const detectedMime = sniffMimeType(bytes);

  if (!detectedMime) {
    return { valid: false, detectedMime: null };
  }

  if (!expectedMimeType || expectedMimeType.trim() === '') {
    return { valid: true, detectedMime };
  }

  const cleanExpected = expectedMimeType.split(';')[0].trim().toLowerCase();

  // Allow image/jpg alias for image/jpeg
  const isMatch =
    cleanExpected === detectedMime ||
    (cleanExpected === 'image/jpg' && detectedMime === 'image/jpeg');

  return {
    valid: isMatch,
    detectedMime,
  };
}
