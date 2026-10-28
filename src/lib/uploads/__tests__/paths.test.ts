import { describe, it, expect } from 'vitest';
import {
  buildDocumentStoragePath,
  parseDocumentStoragePath,
  isValidUuid,
} from '../paths';

describe('isValidUuid', () => {
  it('returns true for valid standard UUIDs (v4)', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUuid('b2c3d4e5-f6a7-4890-a1b2-c3d4e5f6a7b8')).toBe(true);
    expect(isValidUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('is case-insensitive for hex characters', () => {
    expect(isValidUuid('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true);
    expect(isValidUuid('a0eebc99-9C0B-4ef8-BB6D-6bb9bd380a11')).toBe(true);
  });

  it('returns false for invalid UUIDs', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // 1 char short
    expect(isValidUuid('123e4567-e89b-12d3-a456-4266141740001')).toBe(false); // 1 char extra
    expect(isValidUuid('123e4567e89b12d3a456426614174000')).toBe(false); // no hyphens
    expect(isValidUuid('123e4567-e89b-12d3-a456-42661417400z')).toBe(false); // invalid hex 'z'
    expect(isValidUuid(null as unknown as string)).toBe(false);
    expect(isValidUuid(undefined as unknown as string)).toBe(false);
  });
});

describe('buildDocumentStoragePath', () => {
  const firmId = '123e4567-e89b-12d3-a456-426614174000';
  const clientId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const documentId = 'b2c3d4e5-f6a7-4890-a1b2-c3d4e5f6a7b8';

  it('builds standard path: firmId/clientId/documentId', () => {
    const path = buildDocumentStoragePath(firmId, clientId, documentId);
    expect(path).toBe(`${firmId}/${clientId}/${documentId}`);
  });

  it('trims leading/trailing whitespace and slashes from parts', () => {
    const path = buildDocumentStoragePath(
      `  /${firmId}/  `,
      `/${clientId}`,
      `${documentId}/ `
    );
    expect(path).toBe(`${firmId}/${clientId}/${documentId}`);
  });

  it('throws when firmId is missing or empty', () => {
    expect(() => buildDocumentStoragePath('', clientId, documentId)).toThrowError(
      /firmId, clientId, and documentId are all required/
    );
    expect(() =>
      buildDocumentStoragePath('   ', clientId, documentId)
    ).toThrowError(/firmId, clientId, and documentId are all required/);
    expect(() =>
      buildDocumentStoragePath(null as unknown as string, clientId, documentId)
    ).toThrowError();
  });

  it('throws when clientId is missing or empty', () => {
    expect(() => buildDocumentStoragePath(firmId, '', documentId)).toThrowError(
      /firmId, clientId, and documentId are all required/
    );
    expect(() =>
      buildDocumentStoragePath(firmId, '   ', documentId)
    ).toThrowError();
    expect(() =>
      buildDocumentStoragePath(firmId, undefined as unknown as string, documentId)
    ).toThrowError();
  });

  it('throws when documentId is missing or empty', () => {
    expect(() => buildDocumentStoragePath(firmId, clientId, '')).toThrowError(
      /firmId, clientId, and documentId are all required/
    );
    expect(() =>
      buildDocumentStoragePath(firmId, clientId, '   ')
    ).toThrowError();
  });
});

describe('parseDocumentStoragePath', () => {
  const firmId = '123e4567-e89b-12d3-a456-426614174000';
  const clientId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const documentId = 'b2c3d4e5-f6a7-4890-a1b2-c3d4e5f6a7b8';

  it('successfully parses valid 3-segment UUID path', () => {
    const path = `${firmId}/${clientId}/${documentId}`;
    const parsed = parseDocumentStoragePath(path);
    expect(parsed).toEqual({
      firmId,
      clientId,
      documentId,
    });
  });

  it('strips leading and trailing slashes correctly', () => {
    const path = `/${firmId}/${clientId}/${documentId}/`;
    const parsed = parseDocumentStoragePath(path);
    expect(parsed).toEqual({
      firmId,
      clientId,
      documentId,
    });
  });

  it('rejects path with fewer than 3 segments', () => {
    expect(parseDocumentStoragePath(`${firmId}/${clientId}`)).toBeNull();
    expect(parseDocumentStoragePath(firmId)).toBeNull();
  });

  it('rejects path with more than 3 segments', () => {
    expect(
      parseDocumentStoragePath(`${firmId}/${clientId}/${documentId}/extra-file.pdf`)
    ).toBeNull();
    expect(
      parseDocumentStoragePath(`documents/${firmId}/${clientId}/${documentId}`)
    ).toBeNull();
  });

  it('rejects path with empty segments', () => {
    expect(parseDocumentStoragePath(`${firmId}//${documentId}`)).toBeNull();
    expect(parseDocumentStoragePath(`//${firmId}/${clientId}/${documentId}`)).toBeNull();
  });

  it('rejects non-UUID segments', () => {
    expect(parseDocumentStoragePath(`invalid-firm/${clientId}/${documentId}`)).toBeNull();
    expect(parseDocumentStoragePath(`${firmId}/invalid-client/${documentId}`)).toBeNull();
    expect(parseDocumentStoragePath(`${firmId}/${clientId}/invalid-doc`)).toBeNull();
  });

  it('rejects path traversal attempts', () => {
    expect(parseDocumentStoragePath(`../../${clientId}/${documentId}`)).toBeNull();
    expect(parseDocumentStoragePath(`${firmId}/../${documentId}`)).toBeNull();
  });

  it('returns null for empty string or whitespace', () => {
    expect(parseDocumentStoragePath('')).toBeNull();
    expect(parseDocumentStoragePath('   ')).toBeNull();
    expect(parseDocumentStoragePath('///')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseDocumentStoragePath(null as unknown as string)).toBeNull();
    expect(parseDocumentStoragePath(undefined as unknown as string)).toBeNull();
    expect(parseDocumentStoragePath(123 as unknown as string)).toBeNull();
  });

  it('roundtrips with buildDocumentStoragePath', () => {
    const path = buildDocumentStoragePath(firmId, clientId, documentId);
    const parsed = parseDocumentStoragePath(path);
    expect(parsed).toEqual({ firmId, clientId, documentId });
  });
});
