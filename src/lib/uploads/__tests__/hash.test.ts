import { describe, it, expect } from 'vitest';
import {
  computeSha256,
  computeSha256Node,
  computeSha256Subtle,
} from '../hash';

describe('computeSha256', () => {
  const EMPTY_HASH =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const HELLO_HASH =
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  const FOX_HASH =
    'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592';

  describe('Standard SHA-256 test vectors', () => {
    it('computes correct hash for empty data', async () => {
      const hash = await computeSha256(new Uint8Array(0));
      expect(hash).toBe(EMPTY_HASH);
    });

    it('computes correct hash for "hello"', async () => {
      const bytes = new TextEncoder().encode('hello');
      const hash = await computeSha256(bytes);
      expect(hash).toBe(HELLO_HASH);
    });

    it('computes correct hash for "The quick brown fox jumps over the lazy dog"', async () => {
      const bytes = new TextEncoder().encode(
        'The quick brown fox jumps over the lazy dog'
      );
      const hash = await computeSha256(bytes);
      expect(hash).toBe(FOX_HASH);
    });

    it('always returns lowercase 64-character hex strings', async () => {
      const bytes = new TextEncoder().encode('Invoice-2026-GST-001');
      const hash = await computeSha256(bytes);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Input type support', () => {
    it('computes identical hashes for Buffer, Uint8Array, and ArrayBuffer', async () => {
      const raw = 'GSTIN-27AABCU9603R1ZM-BILL';
      const u8 = new TextEncoder().encode(raw);
      const buf = Buffer.from(raw);
      const arrayBuffer = u8.buffer.slice(
        u8.byteOffset,
        u8.byteOffset + u8.byteLength
      );

      const hash1 = await computeSha256(u8);
      const hash2 = await computeSha256(buf);
      const hash3 = await computeSha256(arrayBuffer);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toHaveLength(64);
    });

    it('correctly handles Uint8Array slices with non-zero byteOffset', async () => {
      const padded = new Uint8Array([0x00, 0x00, 0x00, 104, 101, 108, 108, 111]); // prefix + 'hello'
      const slice = padded.subarray(3); // 'hello'

      const hash = await computeSha256(slice);
      expect(hash).toBe(HELLO_HASH);
    });
  });

  describe('computeSha256Node', () => {
    it('computes hash via Node.js crypto module', async () => {
      const bytes = new TextEncoder().encode('hello');
      const hash = await computeSha256Node(bytes);
      expect(hash).toBe(HELLO_HASH);
    });

    it('handles empty ArrayBuffer via Node crypto', async () => {
      const hash = await computeSha256Node(new ArrayBuffer(0));
      expect(hash).toBe(EMPTY_HASH);
    });

    it('throws TypeError for non-buffer inputs', async () => {
      await expect(
        computeSha256Node('hello' as unknown as Uint8Array)
      ).rejects.toThrow(TypeError);
    });
  });

  describe('computeSha256Subtle', () => {
    it('computes hash using globalThis.crypto.subtle', async () => {
      const bytes = new TextEncoder().encode('hello');
      const hash = await computeSha256Subtle(bytes);
      expect(hash).toBe(HELLO_HASH);
    });

    it('computes hash for full and sliced ArrayBufferViews', async () => {
      const padded = new Uint8Array([99, 99, 104, 101, 108, 108, 111]);
      const slice = padded.subarray(2);
      const hash = await computeSha256Subtle(slice);
      expect(hash).toBe(HELLO_HASH);
    });

    it('throws TypeError for non-buffer inputs', async () => {
      await expect(
        computeSha256Subtle(12345 as unknown as Uint8Array)
      ).rejects.toThrow(TypeError);
    });

    it('throws if SubtleCrypto is unavailable', async () => {
      await expect(
        computeSha256Subtle(new Uint8Array(0), {} as SubtleCrypto)
      ).rejects.toThrow(/SubtleCrypto is not available/);
    });
  });

  describe('Browser environment fallback path', () => {
    it('falls back to SubtleCrypto when window is defined', async () => {
      // Simulate browser environment with window defined
      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        (globalThis as unknown as { window: unknown }).window = {};
        const bytes = new TextEncoder().encode('hello');
        const hash = await computeSha256(bytes);
        expect(hash).toBe(HELLO_HASH);
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as unknown as { window?: unknown }).window;
        } else {
          (globalThis as unknown as { window: unknown }).window = originalWindow;
        }
      }
    });
  });
});
