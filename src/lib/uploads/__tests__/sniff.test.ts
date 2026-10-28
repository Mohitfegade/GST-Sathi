import { describe, it, expect } from 'vitest';
import { sniffMimeType, isValidDocumentBytes } from '../sniff';

describe('sniffMimeType', () => {
  describe('JPEG detection', () => {
    it('detects standard JPEG starting with FF D8 FF', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(sniffMimeType(bytes)).toBe('image/jpeg');
    });

    it('detects JPEG from Node Buffer', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
      expect(sniffMimeType(buffer)).toBe('image/jpeg');
    });

    it('detects JPEG from ArrayBuffer', () => {
      const u8 = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
      expect(sniffMimeType(u8.buffer)).toBe('image/jpeg');
    });

    it('detects JPEG from Uint8Array slice with non-zero offset', () => {
      const whole = new Uint8Array([0x00, 0x00, 0xff, 0xd8, 0xff, 0xe0]);
      const slice = whole.subarray(2);
      expect(sniffMimeType(slice)).toBe('image/jpeg');
    });

    it('rejects truncated bytes (<3 bytes)', () => {
      const bytes = new Uint8Array([0xff, 0xd8]);
      expect(sniffMimeType(bytes)).toBeNull();
    });

    it('rejects invalid third byte (FF D8 00)', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0x00, 0x00]);
      expect(sniffMimeType(bytes)).toBeNull();
    });
  });

  describe('PNG detection', () => {
    it('detects standard PNG with 89 50 4E 47 0D 0A 1A 0A', () => {
      const bytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      expect(sniffMimeType(bytes)).toBe('image/png');
    });

    it('detects PNG from Buffer', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(sniffMimeType(buf)).toBe('image/png');
    });

    it('rejects truncated PNG (< 8 bytes)', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
      expect(sniffMimeType(bytes)).toBeNull();
    });

    it('rejects corrupt PNG byte', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0x1a, 0x0a]);
      expect(sniffMimeType(bytes)).toBeNull();
    });
  });

  describe('WebP detection', () => {
    it('detects WebP with RIFF at 0-3 and WEBP at 8-11', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // file length placeholder
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8_
      ]);
      expect(sniffMimeType(bytes)).toBe('image/webp');
    });

    it('detects WebP from ArrayBuffer', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      expect(sniffMimeType(bytes.buffer)).toBe('image/webp');
    });

    it('rejects non-WebP RIFF containers (e.g., AVI)', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x41, 0x56, 0x49, 0x20, // AVI_
      ]);
      expect(sniffMimeType(bytes)).toBeNull();
    });

    it('rejects truncated WebP (< 12 bytes)', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42,
      ]);
      expect(sniffMimeType(bytes)).toBeNull();
    });

    it('rejects corrupt RIFF signature', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      expect(sniffMimeType(bytes)).toBeNull();
    });
  });

  describe('PDF detection', () => {
    it('detects standard PDF with %PDF-', () => {
      const text = '%PDF-1.4\n%âãÏÓ\n';
      const bytes = new TextEncoder().encode(text);
      expect(sniffMimeType(bytes)).toBe('application/pdf');
    });

    it('detects PDF from Buffer', () => {
      const buf = Buffer.from('%PDF-1.7');
      expect(sniffMimeType(buf)).toBe('application/pdf');
    });

    it('detects exact 5-byte %PDF-', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      expect(sniffMimeType(bytes)).toBe('application/pdf');
    });

    it('rejects truncated PDF (< 5 bytes)', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      expect(sniffMimeType(bytes)).toBeNull();
    });

    it('rejects %PDF with space instead of hyphen', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x20]);
      expect(sniffMimeType(bytes)).toBeNull();
    });
  });

  describe('Unrecognized and edge case inputs', () => {
    it('returns null for empty Uint8Array', () => {
      expect(sniffMimeType(new Uint8Array(0))).toBeNull();
    });

    it('returns null for empty ArrayBuffer', () => {
      expect(sniffMimeType(new ArrayBuffer(0))).toBeNull();
    });

    it('returns null for empty Buffer', () => {
      expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
    });

    it('returns null for plain text files', () => {
      const textBytes = new TextEncoder().encode('Hello, world! Invoice #123');
      expect(sniffMimeType(textBytes)).toBeNull();
    });

    it('returns null for HTML documents', () => {
      const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html><body>Test</body></html>');
      expect(sniffMimeType(htmlBytes)).toBeNull();
    });

    it('returns null for ZIP files (PK..)', () => {
      const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      expect(sniffMimeType(zipBytes)).toBeNull();
    });

    it('returns null for GIF files (GIF89a)', () => {
      const gifBytes = new TextEncoder().encode('GIF89a...');
      expect(sniffMimeType(gifBytes)).toBeNull();
    });

    it('returns null gracefully when null/undefined passed', () => {
      expect(sniffMimeType(null as unknown as Uint8Array)).toBeNull();
      expect(sniffMimeType(undefined as unknown as Uint8Array)).toBeNull();
    });
  });
});

describe('isValidDocumentBytes', () => {
  const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validPdf = new TextEncoder().encode('%PDF-1.5 test document');
  const validWebp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);
  const invalidBytes = new TextEncoder().encode('Invalid text payload');

  it('validates document without expectedMimeType when signature is valid', () => {
    const res = isValidDocumentBytes(validJpeg);
    expect(res).toEqual({
      valid: true,
      detectedMime: 'image/jpeg',
    });
  });

  it('validates document with matching expectedMimeType', () => {
    const res = isValidDocumentBytes(validPng, 'image/png');
    expect(res).toEqual({
      valid: true,
      detectedMime: 'image/png',
    });
  });

  it('accepts image/jpg as alias for image/jpeg', () => {
    const res = isValidDocumentBytes(validJpeg, 'image/jpg');
    expect(res).toEqual({
      valid: true,
      detectedMime: 'image/jpeg',
    });
  });

  it('handles case-insensitive expected MIME types', () => {
    const res = isValidDocumentBytes(validPdf, 'APPLICATION/PDF');
    expect(res).toEqual({
      valid: true,
      detectedMime: 'application/pdf',
    });
  });

  it('strips parameters like charset from expectedMimeType', () => {
    const res = isValidDocumentBytes(validPdf, 'application/pdf; charset=utf-8');
    expect(res).toEqual({
      valid: true,
      detectedMime: 'application/pdf',
    });
  });

  it('validates WebP files correctly', () => {
    const res = isValidDocumentBytes(validWebp, 'image/webp');
    expect(res).toEqual({
      valid: true,
      detectedMime: 'image/webp',
    });
  });

  it('marks invalid when detected MIME does not match expected MIME', () => {
    const res = isValidDocumentBytes(validPng, 'application/pdf');
    expect(res).toEqual({
      valid: false,
      detectedMime: 'image/png',
    });
  });

  it('marks invalid when bytes are not a recognized document format', () => {
    const res1 = isValidDocumentBytes(invalidBytes);
    expect(res1).toEqual({
      valid: false,
      detectedMime: null,
    });

    const res2 = isValidDocumentBytes(invalidBytes, 'application/pdf');
    expect(res2).toEqual({
      valid: false,
      detectedMime: null,
    });
  });

  it('marks invalid when empty bytes are provided', () => {
    const res = isValidDocumentBytes(new Uint8Array(0));
    expect(res).toEqual({
      valid: false,
      detectedMime: null,
    });
  });
});
