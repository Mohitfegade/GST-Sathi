import { getStateName, STATE_CODES } from './state-codes';

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GstinValidationResult {
  valid: boolean;
  error?: string;
  stateCode?: string;
  stateName?: string;
}

export interface StateInfo {
  code: string;
  name: string;
}

/**
 * Calculates the official GSTN Luhn modulo-36 checksum character for the first 14 characters of a GSTIN.
 *
 * Algorithm:
 * - Chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' (values 0-35)
 * - Weights for first 14 characters: factor = (i % 2 === 0) ? 1 : 2
 * - For each char:
 *     product = val * factor
 *     quotient = Math.floor(product / 36)
 *     remainder = product % 36
 *     sum += quotient + remainder
 * - checkDigit = (36 - (sum % 36)) % 36
 * - checkChar = chars[checkDigit]
 */
export function calculateGstinChecksum(first14: string): string {
  if (!first14 || typeof first14 !== 'string') {
    throw new Error('Input must be a non-empty string of 14 characters');
  }

  const normalized = first14.trim().toUpperCase();
  if (normalized.length !== 14) {
    throw new Error(`Expected exactly 14 characters for GSTIN checksum calculation, got ${normalized.length}`);
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = normalized[i];
    const val = GSTIN_CHARS.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid character '${char}' at index ${i} for GSTIN checksum calculation`);
    }

    const factor = i % 2 === 0 ? 1 : 2;
    const product = val * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }

  const checkDigit = (36 - (sum % 36)) % 36;
  return GSTIN_CHARS[checkDigit];
}

/**
 * Validates a 15-character GSTIN string including regex format, valid state code, and Luhn mod-36 checksum.
 * Automatically normalizes casing and trims surrounding whitespace.
 */
export function validateGstin(gstin: string): GstinValidationResult {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is required' };
  }

  const normalized = gstin.trim().toUpperCase();

  if (normalized.length !== 15) {
    return {
      valid: false,
      error: `GSTIN must be exactly 15 characters (received ${normalized.length})`,
    };
  }

  if (!GSTIN_REGEX.test(normalized)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected format: 2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, "Z", 1 checksum character',
    };
  }

  const stateCode = normalized.slice(0, 2);
  const stateName = getStateName(stateCode);

  if (!stateName) {
    return {
      valid: false,
      error: `Invalid state code '${stateCode}' in GSTIN`,
    };
  }

  const expectedChecksum = calculateGstinChecksum(normalized.slice(0, 14));
  const actualChecksum = normalized[14];

  if (actualChecksum !== expectedChecksum) {
    return {
      valid: false,
      error: `Invalid GSTIN checksum: expected '${expectedChecksum}', got '${actualChecksum}'`,
      stateCode,
      stateName,
    };
  }

  return {
    valid: true,
    stateCode,
    stateName,
  };
}

/**
 * Extracts state code and name from a GSTIN.
 * Returns null if GSTIN is too short or state code is not recognized.
 */
export function stateFromGstin(gstin: string): StateInfo | null {
  if (!gstin || typeof gstin !== 'string') {
    return null;
  }

  const trimmed = gstin.trim();
  if (trimmed.length < 2) {
    return null;
  }

  const code = trimmed.slice(0, 2);
  const name = getStateName(code);

  if (!name) {
    return null;
  }

  return { code, name };
}

/**
 * Algorithmically generates a syntactically valid fake GSTIN for testing purposes.
 * Adheres to zero-realistic-data guidelines: random synthetic character sequences.
 */
export function generateFakeGstin(stateCode?: string): string {
  let resolvedCode: string;

  if (stateCode) {
    const name = getStateName(stateCode);
    if (name) {
      resolvedCode = stateCode.trim().padStart(2, '0');
    } else {
      resolvedCode = STATE_CODES[Math.floor(Math.random() * STATE_CODES.length)].code;
    }
  } else {
    resolvedCode = STATE_CODES[Math.floor(Math.random() * STATE_CODES.length)].code;
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const entityChars = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const randomLetter = () => letters[Math.floor(Math.random() * letters.length)];
  const randomDigit = () => digits[Math.floor(Math.random() * digits.length)];

  // PAN format: 5 letters, 4 digits, 1 letter
  const panLetters = Array.from({ length: 5 }, randomLetter).join('');
  const panDigits = Array.from({ length: 4 }, randomDigit).join('');
  const panSuffix = randomLetter();

  // Entity number: 1-9 or A-Z
  const entityNum = entityChars[Math.floor(Math.random() * entityChars.length)];

  // 14th character is always 'Z'
  const zChar = 'Z';

  const first14 = `${resolvedCode}${panLetters}${panDigits}${panSuffix}${entityNum}${zChar}`;
  const checksum = calculateGstinChecksum(first14);

  return `${first14}${checksum}`;
}
