/**
 * Money and paise utilities for GST calculations.
 *
 * Rules:
 * - Financial totals use integer paise representation (bigint).
 * - ZERO floats used in financial totals; exact integer paise arithmetic.
 * - Exact rounding half-up for rate multiplication and rupee rounding.
 */

const B_0 = BigInt(0);
const B_1 = BigInt(1);
const B_2 = BigInt(2);
const B_10 = BigInt(10);
const B_50 = BigInt(50);
const B_100 = BigInt(100);

export interface FormatINROptions {
  /**
   * Whether to show paise (.00) in the formatted output.
   * Defaults to true.
   */
  showPaise?: boolean;
}

/**
 * Converts a rupee amount (number or string) into exact integer paise (bigint).
 * Handles currency symbols (₹, Rs), commas, and spaces.
 * Fractional paise are rounded using exact half-up rounding.
 *
 * @param rupees Rupee amount as number or string (e.g. 100.5, "1,23,456.78", "₹100")
 * @returns Integer paise as bigint
 */
export function toPaise(rupees: number | string): bigint {
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) {
      throw new TypeError(`Invalid rupee amount: ${rupees}`);
    }
  }

  const rawStr = String(rupees).trim();
  if (rawStr === '') {
    throw new Error('Invalid rupee amount: empty string');
  }

  // Remove currency signs (₹, Rs, Rs.), commas, and whitespace
  let cleaned = rawStr.replace(/[\u20B9,]|Rs\.?/gi, '').trim();

  // Handle optional leading negative or positive sign
  let isNegative = false;
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1).trim();
  }

  // Check valid numeric pattern (e.g. "123", "123.45", ".5")
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) {
    throw new Error(`Invalid rupee amount format: "${rawStr}"`);
  }

  const [intPartRaw, fracPartRaw = ''] = cleaned.split('.');
  const intPart = intPartRaw === '' ? '0' : intPartRaw;

  let paise = BigInt(intPart) * B_100;

  if (fracPartRaw.length === 1) {
    paise += BigInt(fracPartRaw) * B_10;
  } else if (fracPartRaw.length === 2) {
    paise += BigInt(fracPartRaw);
  } else if (fracPartRaw.length > 2) {
    // Round half-up based on the 3rd decimal digit
    const firstTwo = BigInt(fracPartRaw.slice(0, 2));
    const thirdDigit = Number(fracPartRaw[2]);
    paise += firstTwo + (thirdDigit >= 5 ? B_1 : B_0);
  }

  return isNegative ? -paise : paise;
}

/**
 * Converts integer paise (bigint) to rupees (number).
 *
 * @param paise Amount in paise (bigint)
 * @returns Rupee amount as number
 */
export function toRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/**
 * Adds multiple paise amounts together using exact bigint arithmetic.
 *
 * @param amounts List of amounts in paise (bigint)
 * @returns Total in paise (bigint)
 */
export function addPaise(...amounts: bigint[]): bigint {
  return amounts.reduce((acc, curr) => acc + curr, B_0);
}

/**
 * Subtracts b from a using exact bigint arithmetic.
 *
 * @param a Minuend in paise (bigint)
 * @param b Subtrahend in paise (bigint)
 * @returns Difference in paise (bigint)
 */
export function subtractPaise(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Multiplies taxable paise by a percentage rate (e.g. 18 for 18%, 2.5 for 2.5%).
 * Computes exact result using integer arithmetic and rounds half-up.
 *
 * @param taxablePaise Base amount in paise (bigint)
 * @param ratePercent Tax rate as a percentage number (e.g. 18, 5, 2.5, 0.1)
 * @returns Tax amount in paise (bigint)
 */
export function multiplyRate(taxablePaise: bigint, ratePercent: number): bigint {
  if (!Number.isFinite(ratePercent)) {
    throw new TypeError(`Invalid tax rate: ${ratePercent}`);
  }

  if (ratePercent === 0 || taxablePaise === B_0) {
    return B_0;
  }

  // Convert ratePercent to an exact rational (numerator / denominator)
  // E.g. 18 -> 18 / 100
  //      2.5 -> 25 / 1000
  //      0.125 -> 125 / 100000
  const rateStr = ratePercent.toString();
  const decimalIndex = rateStr.indexOf('.');
  let decimals = 0;
  if (decimalIndex !== -1) {
    decimals = rateStr.length - decimalIndex - 1;
  }

  const multiplier = BigInt(Math.pow(10, decimals));
  const rateNum = BigInt(Math.round(ratePercent * Math.pow(10, decimals)));
  const rateDen = B_100 * multiplier;

  const prod = taxablePaise * rateNum;

  // Exact division with half-up rounding (symmetric round-half-away-from-zero)
  const isNeg = prod < B_0;
  const absProd = isNeg ? -prod : prod;

  let quotient = absProd / rateDen;
  const remainder = absProd % rateDen;

  if (remainder * B_2 >= rateDen) {
    quotient += B_1;
  }

  return isNeg ? -quotient : quotient;
}

/**
 * Rounds an amount in paise to the nearest whole rupee (multiple of 100 paise),
 * applying standard commercial half-up rounding (>= 50 paise rounds up).
 * Returns the rounded value in paise (bigint).
 *
 * E.g.:
 * 10049 paise -> 10000 paise (₹100.49 -> ₹100.00)
 * 10050 paise -> 10100 paise (₹100.50 -> ₹101.00)
 *
 * @param paise Amount in paise (bigint)
 * @returns Amount rounded to nearest rupee, in paise (bigint)
 */
export function roundToRupee(paise: bigint): bigint {
  if (paise === B_0) return B_0;

  const isNeg = paise < B_0;
  const absPaise = isNeg ? -paise : paise;

  const remainder = absPaise % B_100;
  const roundedAbs = remainder >= B_50
    ? absPaise + (B_100 - remainder)
    : absPaise - remainder;

  return isNeg ? -roundedAbs : roundedAbs;
}

/**
 * Formats an amount into the Indian Numbering System (e.g. ₹1,23,456.78).
 * Accepts number (rupees), string (rupees), or bigint (paise).
 *
 * @param amount Amount as number (rupees), string (rupees), or bigint (paise)
 * @param options Formatting options, e.g. { showPaise: false }
 * @returns Formatted currency string with ₹ prefix
 */
export function formatINR(
  amount: number | string | bigint,
  options?: FormatINROptions
): string {
  const showPaise = options?.showPaise ?? true;

  // Normalize amount to exact integer paise (bigint)
  let paise: bigint;
  if (typeof amount === 'bigint') {
    paise = amount;
  } else {
    paise = toPaise(amount);
  }

  if (!showPaise) {
    paise = roundToRupee(paise);
  }

  const isNeg = paise < B_0;
  const absPaise = isNeg ? -paise : paise;

  const absRupees = absPaise / B_100;
  const rupeesStr = absRupees.toString();

  // Format integer rupee part according to Indian numbering system (3, 2, 2, ...)
  let formattedRupees: string;
  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.slice(-3);
    const rest = rupeesStr.slice(0, -3);
    const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${formattedRest},${lastThree}`;
  }

  const sign = isNeg ? '-' : '';

  if (showPaise) {
    const paisePart = String(absPaise % B_100).padStart(2, '0');
    return `${sign}₹${formattedRupees}.${paisePart}`;
  }

  return `${sign}₹${formattedRupees}`;
}
