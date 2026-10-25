/**
 * Return period (fp) and GST statutory due date utilities.
 *
 * Return period format: "MMYYYY" (e.g. "042026" for April 2026).
 */

export interface ParsedFp {
  month: number;
  year: number;
  monthName: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Category 1 States for QRMP GSTR-3B (Due date: 22nd of month following quarter):
 * Chhattisgarh (22), Madhya Pradesh (23), Gujarat (24), Maharashtra (27),
 * Karnataka (29), Goa (30), Kerala (32), Tamil Nadu (33), Telangana (36),
 * Andhra Pradesh (37), Dadra & Nagar Haveli and Daman & Diu (26 / 25),
 * Puducherry (34), Andaman & Nicobar (35), Lakshadweep (31).
 */
const QRMP_CAT1_STATE_CODES = new Set([
  '22', '23', '24', '25', '26', '27', '29', '30',
  '31', '32', '33', '34', '35', '36', '37',
]);

/**
 * Parses a GST return period "fp" (MMYYYY).
 *
 * @param fp 6-digit period string e.g. "042026"
 * @returns Object with month (1-12), year (e.g. 2026), and monthName ("April")
 */
export function parseFp(fp: string): ParsedFp {
  if (typeof fp !== 'string') {
    throw new TypeError(`Expected fp to be a string, got ${typeof fp}`);
  }

  const clean = fp.trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new Error(`Invalid fp format: "${fp}". Expected MMYYYY (6 digits).`);
  }

  const month = parseInt(clean.slice(0, 2), 10);
  const year = parseInt(clean.slice(2), 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in fp "${fp}": ${month}. Must be between 01 and 12.`);
  }

  return {
    month,
    year,
    monthName: MONTH_NAMES[month - 1],
  };
}

/**
 * Formats a month and year into a 6-digit return period "fp" (MMYYYY).
 *
 * @param month Month (1-12)
 * @param year 4-digit Year (e.g. 2026)
 * @returns Period string "MMYYYY"
 */
export function formatFp(month: number, year: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be an integer between 1 and 12.`);
  }
  if (!Number.isInteger(year) || year <= 0) {
    throw new Error(`Invalid year: ${year}. Must be a positive integer.`);
  }

  const monthStr = String(month).padStart(2, '0');
  const yearStr = String(year).padStart(4, '0');
  return `${monthStr}${yearStr}`;
}

/**
 * Computes the Indian Financial Year (FY) for a return period "fp" (e.g. "042026" -> "2026-27", "022027" -> "2026-27").
 * FY runs from April 1 to March 31.
 *
 * @param fp Period string "MMYYYY"
 * @returns Financial year string e.g. "2026-27"
 */
export function getFinancialYear(fp: string): string {
  const { month, year } = parseFp(fp);

  if (month >= 4) {
    const endYearStr = String((year + 1) % 100).padStart(2, '0');
    return `${year}-${endYearStr}`;
  } else {
    const startYear = year - 1;
    const endYearStr = String(year % 100).padStart(2, '0');
    return `${startYear}-${endYearStr}`;
  }
}

/**
 * Returns the month following the end of the quarter for a given month and year.
 * Q1: Apr-Jun -> July
 * Q2: Jul-Sep -> October
 * Q3: Oct-Dec -> January (year + 1)
 * Q4: Jan-Mar -> April
 */
function getNextQuarterMonth(month: number, year: number): { dueMonth: number; dueYear: number } {
  if (month >= 4 && month <= 6) {
    return { dueMonth: 7, dueYear: year };
  } else if (month >= 7 && month <= 9) {
    return { dueMonth: 10, dueYear: year };
  } else if (month >= 10 && month <= 12) {
    return { dueMonth: 1, dueYear: year + 1 };
  } else {
    // 1, 2, 3
    return { dueMonth: 4, dueYear: year };
  }
}

/**
 * Returns the month subsequent to the given month and year.
 */
function getSubsequentMonth(month: number, year: number): { dueMonth: number; dueYear: number } {
  if (month === 12) {
    return { dueMonth: 1, dueYear: year + 1 };
  }
  return { dueMonth: month + 1, dueYear: year };
}

/**
 * Computes the statutory due date for filing Form GSTR-1.
 * - Regular scheme: 11th of the subsequent month.
 * - QRMP scheme: 13th of the month following the quarter.
 *
 * @param fp Return period "MMYYYY"
 * @param scheme 'regular' | 'qrmp'
 * @returns Date object representing the due date
 */
export function getGstr1DueDate(fp: string, scheme: 'regular' | 'qrmp'): Date {
  const { month, year } = parseFp(fp);

  if (scheme === 'regular') {
    const { dueMonth, dueYear } = getSubsequentMonth(month, year);
    return new Date(dueYear, dueMonth - 1, 11);
  }

  if (scheme === 'qrmp') {
    const { dueMonth, dueYear } = getNextQuarterMonth(month, year);
    return new Date(dueYear, dueMonth - 1, 13);
  }

  throw new Error(`Unsupported scheme: ${scheme}`);
}

/**
 * Computes the statutory due date for filing Form GSTR-3B.
 * - Regular scheme: 20th of the subsequent month.
 * - QRMP scheme: Staggered due date in the month following the quarter:
 *   - 22nd for Category 1 States (South & West India, e.g. MH, GJ, KA, TN).
 *   - 24th for Category 2 States (North & East India, e.g. DL, UP, PB, WB).
 *   - Defaults to 22nd if stateCode is omitted.
 *
 * @param fp Return period "MMYYYY"
 * @param scheme 'regular' | 'qrmp'
 * @param stateCode 2-digit GST state code (e.g. "27" for Maharashtra, "07" for Delhi) or GSTIN
 * @returns Date object representing the due date
 */
export function getGstr3bDueDate(
  fp: string,
  scheme: 'regular' | 'qrmp',
  stateCode?: string
): Date {
  const { month, year } = parseFp(fp);

  if (scheme === 'regular') {
    const { dueMonth, dueYear } = getSubsequentMonth(month, year);
    return new Date(dueYear, dueMonth - 1, 20);
  }

  if (scheme === 'qrmp') {
    const { dueMonth, dueYear } = getNextQuarterMonth(month, year);

    let dueDay = 22; // Default to Category 1
    if (stateCode && stateCode.trim() !== '') {
      const code = stateCode.trim().slice(0, 2).padStart(2, '0');
      dueDay = QRMP_CAT1_STATE_CODES.has(code) ? 22 : 24;
    }

    return new Date(dueYear, dueMonth - 1, dueDay);
  }

  throw new Error(`Unsupported scheme: ${scheme}`);
}

/**
 * Computes the date when Form GSTR-2B is auto-drafted and arrives on the GST portal.
 * Standard arrival date is the 14th of the subsequent month (after the 13th GSTR-1/IFF deadline).
 *
 * @param fp Return period "MMYYYY"
 * @returns Date object representing the GSTR-2B arrival date
 */
export function getGstr2bArrivalDate(fp: string): Date {
  const { month, year } = parseFp(fp);
  const { dueMonth, dueYear } = getSubsequentMonth(month, year);
  return new Date(dueYear, dueMonth - 1, 14);
}
