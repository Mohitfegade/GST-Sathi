import { describe, it, expect } from 'vitest';
import {
  calculateGstinChecksum,
  validateGstin,
  stateFromGstin,
  generateFakeGstin,
} from '../gstin';
import {
  STATE_CODES,
  STATE_CODE_MAP,
  getStateName,
} from '../state-codes';

describe('GST State Codes', () => {
  it('should include all official state codes (01 to 38, 97, 99)', () => {
    expect(STATE_CODES.length).toBe(40);

    const codes = STATE_CODES.map((s) => s.code);
    // Check range 01-38
    for (let i = 1; i <= 38; i++) {
      const codeStr = String(i).padStart(2, '0');
      expect(codes).toContain(codeStr);
    }
    // Check 97 and 99
    expect(codes).toContain('97');
    expect(codes).toContain('99');
  });

  it('should map state codes correctly in STATE_CODE_MAP', () => {
    expect(STATE_CODE_MAP['27']).toBe('Maharashtra');
    expect(STATE_CODE_MAP['29']).toBe('Karnataka');
    expect(STATE_CODE_MAP['07']).toBe('Delhi');
    expect(STATE_CODE_MAP['37']).toBe('Andhra Pradesh');
    expect(STATE_CODE_MAP['38']).toBe('Ladakh');
    expect(STATE_CODE_MAP['97']).toBe('Other Territory');
    expect(STATE_CODE_MAP['99']).toBe('Centre Jurisdiction');
  });

  it('getStateName should return correct state name for valid codes', () => {
    expect(getStateName('29')).toBe('Karnataka');
    expect(getStateName('07')).toBe('Delhi');
    expect(getStateName('7')).toBe('Delhi');
    expect(getStateName(' 27 ')).toBe('Maharashtra');
  });

  it('getStateName should return null for invalid or empty codes', () => {
    expect(getStateName('')).toBeNull();
    expect(getStateName('00')).toBeNull();
    expect(getStateName('39')).toBeNull();
    expect(getStateName('98')).toBeNull();
    expect(getStateName('ZZ')).toBeNull();
  });
});

describe('GSTIN Checksum Calculation', () => {
  it('should accurately calculate official GSTN Luhn mod-36 checksum', () => {
    // 27ABCDE1234F1Z -> 0
    expect(calculateGstinChecksum('27ABCDE1234F1Z')).toBe('0');

    // 07AAAAA0000A1Z -> 4
    expect(calculateGstinChecksum('07AAAAA0000A1Z')).toBe('4');

    // 29AAAAA0000A1Z -> Y
    expect(calculateGstinChecksum('29AAAAA0000A1Z')).toBe('Y');
  });

  it('should handle lowercase input in calculateGstinChecksum', () => {
    expect(calculateGstinChecksum('27abcde1234f1z')).toBe('0');
  });

  it('should throw error when input length is not 14', () => {
    expect(() => calculateGstinChecksum('27ABCDE1234F1')).toThrow(/Expected exactly 14 characters/);
    expect(() => calculateGstinChecksum('27ABCDE1234F1Z0')).toThrow(/Expected exactly 14 characters/);
    expect(() => calculateGstinChecksum('')).toThrow();
  });

  it('should throw error when invalid characters are present', () => {
    expect(() => calculateGstinChecksum('27ABCDE1234F1!')).toThrow(/Invalid character/);
  });
});

describe('GSTIN Validation', () => {
  it('should validate correctly formatted fake GSTINs with valid checksums', () => {
    const valid1 = '27ABCDE1234F1Z0';
    const result1 = validateGstin(valid1);
    expect(result1.valid).toBe(true);
    expect(result1.stateCode).toBe('27');
    expect(result1.stateName).toBe('Maharashtra');
    expect(result1.error).toBeUndefined();

    const valid2 = '07AAAAA0000A1Z4';
    const result2 = validateGstin(valid2);
    expect(result2.valid).toBe(true);
    expect(result2.stateCode).toBe('07');
    expect(result2.stateName).toBe('Delhi');

    const valid3 = '29AAAAA0000A1ZY';
    const result3 = validateGstin(valid3);
    expect(result3.valid).toBe(true);
    expect(result3.stateCode).toBe('29');
    expect(result3.stateName).toBe('Karnataka');
  });

  it('should normalize lowercase and whitespace in validateGstin', () => {
    const result = validateGstin('  29aaaaa0000a1zy  ');
    expect(result.valid).toBe(true);
    expect(result.stateCode).toBe('29');
    expect(result.stateName).toBe('Karnataka');
  });

  it('should fail when checksum digit is incorrect', () => {
    const invalidChecksum = '27ABCDE1234F1Z1'; // Checksum is 0, not 1
    const result = validateGstin(invalidChecksum);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid GSTIN checksum');
  });

  it('should fail when state code is invalid', () => {
    // 00 is not a valid state code
    const invalidState = '00ABCDE1234F1Z0';
    const result = validateGstin(invalidState);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid state code');
  });

  it('should fail when format structure is invalid', () => {
    // Too short
    expect(validateGstin('27ABCDE1234F1Z').valid).toBe(false);
    // Too long
    expect(validateGstin('27ABCDE1234F1Z00').valid).toBe(false);
    // Missing 'Z' at 14th character
    expect(validateGstin('27ABCDE1234F1A0').valid).toBe(false);
    // Non-alphanumeric characters
    expect(validateGstin('27ABCD@1234F1Z0').valid).toBe(false);
    // Empty string
    expect(validateGstin('').valid).toBe(false);
  });
});

describe('stateFromGstin', () => {
  it('should extract state code and name from valid GSTIN or prefix', () => {
    expect(stateFromGstin('27ABCDE1234F1Z0')).toEqual({
      code: '27',
      name: 'Maharashtra',
    });
    expect(stateFromGstin('07AAAAA0000A1Z4')).toEqual({
      code: '07',
      name: 'Delhi',
    });
  });

  it('should return null for invalid or missing state prefix', () => {
    expect(stateFromGstin('00ABCDE1234F1Z0')).toBeNull();
    expect(stateFromGstin('X')).toBeNull();
    expect(stateFromGstin('')).toBeNull();
  });
});

describe('generateFakeGstin', () => {
  it('should generate valid fake GSTIN for specified state code', () => {
    const gstin = generateFakeGstin('07');
    expect(gstin.startsWith('07')).toBe(true);
    expect(gstin.length).toBe(15);

    const validation = validateGstin(gstin);
    expect(validation.valid).toBe(true);
    expect(validation.stateCode).toBe('07');
    expect(validation.stateName).toBe('Delhi');
  });

  it('should generate valid fake GSTIN without arguments', () => {
    const gstin = generateFakeGstin();
    expect(gstin.length).toBe(15);

    const validation = validateGstin(gstin);
    expect(validation.valid).toBe(true);
    expect(validation.stateName).toBeDefined();
  });

  it('should reliably generate 100 valid fake GSTINs across multiple states', () => {
    for (let i = 0; i < 100; i++) {
      const gstin = generateFakeGstin();
      const validation = validateGstin(gstin);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
      expect(validation.stateCode).toBeDefined();
      expect(validation.stateName).toBeDefined();
    }
  });
});
