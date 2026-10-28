/**
 * Computes SHA-256 hash using Node.js crypto module.
 *
 * @param data Data buffer, typed array, or ArrayBuffer
 * @returns 64-character lowercase hexadecimal hash string
 */
export async function computeSha256Node(
  data: ArrayBuffer | Uint8Array | Buffer
): Promise<string> {
  const { createHash } = await import('crypto');

  let uint8: Uint8Array;
  if (data instanceof Uint8Array) {
    uint8 = data;
  } else if (data instanceof ArrayBuffer) {
    uint8 = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    uint8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  } else {
    throw new TypeError('Expected ArrayBuffer, Uint8Array, or Buffer');
  }

  return createHash('sha256').update(uint8).digest('hex').toLowerCase();
}

/**
 * Computes SHA-256 hash using the Web Cryptography API (SubtleCrypto).
 *
 * @param data Data buffer, typed array, or ArrayBuffer
 * @param subtleInstance Optional SubtleCrypto instance (defaults to globalThis.crypto.subtle)
 * @returns 64-character lowercase hexadecimal hash string
 */
export async function computeSha256Subtle(
  data: ArrayBuffer | Uint8Array | Buffer,
  subtleInstance?: SubtleCrypto
): Promise<string> {
  const subtle = subtleInstance ?? globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new Error('SubtleCrypto is not available in this environment');
  }

  let bufferToDigest: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    bufferToDigest = data;
  } else if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
      bufferToDigest = view.buffer as ArrayBuffer;
    } else {
      bufferToDigest = view.buffer.slice(
        view.byteOffset,
        view.byteOffset + view.byteLength
      ) as ArrayBuffer;
    }
  } else {
    throw new TypeError('Expected ArrayBuffer, Uint8Array, or Buffer');
  }

  const hashBuffer = await subtle.digest('SHA-256', bufferToDigest);
  const hashBytes = new Uint8Array(hashBuffer);

  let hex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }

  return hex.toLowerCase();
}

/**
 * Computes the SHA-256 checksum of document bytes.
 * Uses Node crypto (`crypto.createHash('sha256')`) when in a Node.js environment,
 * or `globalThis.crypto.subtle.digest('SHA-256')` when running in the browser.
 *
 * @param data ArrayBuffer, Uint8Array, or Buffer to hash
 * @returns Promise resolving to a 64-character lowercase hexadecimal string
 */
export async function computeSha256(
  data: ArrayBuffer | Uint8Array | Buffer
): Promise<string> {
  const isNode =
    typeof process !== 'undefined' &&
    Boolean(process.versions?.node) &&
    typeof window === 'undefined';

  if (isNode) {
    try {
      return await computeSha256Node(data);
    } catch {
      // Fallback to SubtleCrypto if Node crypto import fails
    }
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return computeSha256Subtle(data);
  }

  return computeSha256Node(data);
}
