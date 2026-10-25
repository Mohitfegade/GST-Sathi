export type FilingStatus = 'filed' | 'not_filed' | 'unknown';

export interface VerifyGstinResult {
  isValid: boolean;
  stateCode?: string;
  pan?: string;
  error?: string;
}

export interface CheckFilingStatusResult {
  gstin: string;
  filingStatus: FilingStatus;
}

export interface GstinVerifierAdapter {
  verifyGstinFormat(gstin: string): { isValid: boolean; stateCode?: string; pan?: string; error?: string };
  checkFilingStatus(gstin: string): Promise<{ gstin: string; filingStatus: FilingStatus }>;
}

const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_REGEX = /^([0-9]{2})([A-Z]{5}[0-9]{4}[A-Z]{1})([0-9A-Z]{1})Z([0-9A-Z]{1})$/;

export class OfflineGstinVerifierAdapter implements GstinVerifierAdapter {
  private readonly filingStatusOverrides = new Map<string, FilingStatus>();

  constructor(initialStatusMap?: Record<string, FilingStatus>) {
    if (initialStatusMap) {
      for (const [gstin, status] of Object.entries(initialStatusMap)) {
        this.filingStatusOverrides.set(gstin.trim().toUpperCase(), status);
      }
    }
  }

  /**
   * Validates GSTIN offline using 15-character structural regex and Luhn Mod-36 checksum.
   */
  verifyGstinFormat(gstin: string): { isValid: boolean; stateCode?: string; pan?: string; error?: string } {
    if (!gstin || typeof gstin !== 'string') {
      return {
        isValid: false,
        error: 'GSTIN must be a non-empty string',
      };
    }

    const clean = gstin.trim().toUpperCase();

    if (clean.length !== 15) {
      return {
        isValid: false,
        error: `GSTIN must be exactly 15 characters long (received ${clean.length})`,
      };
    }

    const match = clean.match(GSTIN_REGEX);
    if (!match) {
      // Diagnostic hints
      const statePart = clean.slice(0, 2);
      const panPart = clean.slice(2, 12);
      const zPart = clean[13];

      if (!/^\d{2}$/.test(statePart)) {
        return {
          isValid: false,
          error: `Invalid state code '${statePart}'. First 2 characters must be digits (01-38, 97, 99)`,
        };
      }
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(panPart)) {
        return {
          isValid: false,
          stateCode: statePart,
          error: `Invalid PAN format in GSTIN: '${panPart}'. Expected 5 letters, 4 digits, 1 letter`,
        };
      }
      if (zPart !== 'Z') {
        return {
          isValid: false,
          stateCode: statePart,
          pan: panPart,
          error: `14th character of GSTIN must be 'Z' (found '${zPart}')`,
        };
      }

      return {
        isValid: false,
        error: 'Invalid GSTIN structure',
      };
    }

    const stateCode = match[1];
    const pan = match[2];

    // Luhn Mod-36 checksum verification over first 14 characters
    const mod = GSTIN_ALPHABET.length;
    let total = 0;

    for (let i = 0; i < 14; i++) {
      const char = clean[i];
      const charIndex = GSTIN_ALPHABET.indexOf(char);
      if (charIndex === -1) {
        return {
          isValid: false,
          stateCode,
          pan,
          error: `Invalid character '${char}' in GSTIN`,
        };
      }

      const factor = i % 2 === 1 ? 2 : 1;
      const product = charIndex * factor;
      total += Math.floor(product / mod) + (product % mod);
    }

    const remainder = total % mod;
    const expectedChecksum = GSTIN_ALPHABET[(mod - remainder) % mod];
    const actualChecksum = clean[14];

    if (actualChecksum !== expectedChecksum) {
      return {
        isValid: false,
        stateCode,
        pan,
        error: `Invalid checksum digit: expected '${expectedChecksum}', got '${actualChecksum}'`,
      };
    }

    return {
      isValid: true,
      stateCode,
      pan,
    };
  }

  /**
   * Offline filing status check.
   * Without external GST portal connectivity, returns configured offline mock status or 'unknown'.
   */
  async checkFilingStatus(gstin: string): Promise<{ gstin: string; filingStatus: FilingStatus }> {
    const clean = (gstin ?? '').trim().toUpperCase();
    const mockStatus = this.filingStatusOverrides.get(clean);

    return {
      gstin: clean,
      filingStatus: mockStatus ?? 'unknown',
    };
  }

  /**
   * Allows setting mock filing status for testing / offline simulations.
   */
  setFilingStatus(gstin: string, status: FilingStatus): void {
    this.filingStatusOverrides.set(gstin.trim().toUpperCase(), status);
  }

  clearFilingStatuses(): void {
    this.filingStatusOverrides.clear();
  }
}
