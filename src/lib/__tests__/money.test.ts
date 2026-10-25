import { describe, it, expect } from 'vitest';
import {
  toPaise,
  toRupees,
  formatINR,
  addPaise,
  subtractPaise,
  multiplyRate,
  roundToRupee,
} from '../money';

const b = (val: number | string | bigint) => BigInt(val);

describe('money utilities', () => {
  describe('toPaise', () => {
    it('converts integer numbers to paise', () => {
      expect(toPaise(0)).toBe(b(0));
      expect(toPaise(1)).toBe(b(100));
      expect(toPaise(100)).toBe(b(10000));
      expect(toPaise(100000)).toBe(b(10000000));
    });

    it('converts floating point numbers to paise accurately', () => {
      expect(toPaise(0.5)).toBe(b(50));
      expect(toPaise(100.5)).toBe(b(10050));
      expect(toPaise(100.05)).toBe(b(10005));
      expect(toPaise(123456.78)).toBe(b(12345678));
    });

    it('avoids standard IEEE 754 float precision pitfalls', () => {
      // 0.1 + 0.2 in JS is 0.30000000000000004
      expect(toPaise(0.1 + 0.2)).toBe(b(30));
      expect(toPaise(1.0000000000000002)).toBe(b(100));
    });

    it('rounds sub-paise half-up when extra decimals exist', () => {
      expect(toPaise('10.005')).toBe(b(1001));
      expect(toPaise('10.004')).toBe(b(1000));
      expect(toPaise('10.006')).toBe(b(1001));
    });

    it('parses formatted strings with commas and symbols', () => {
      expect(toPaise('100.50')).toBe(b(10050));
      expect(toPaise('₹1,23,456.78')).toBe(b(12345678));
      expect(toPaise('Rs. 1,00,000.00')).toBe(b(10000000));
      expect(toPaise(' Rs 500 ')).toBe(b(50000));
      expect(toPaise('.75')).toBe(b(75));
    });

    it('handles negative amounts correctly', () => {
      expect(toPaise(-50.25)).toBe(b(-5025));
      expect(toPaise('-50.25')).toBe(b(-5025));
      expect(toPaise('-₹1,23,456.78')).toBe(b(-12345678));
    });

    it('throws errors on invalid inputs', () => {
      expect(() => toPaise('')).toThrow();
      expect(() => toPaise('abc')).toThrow();
      expect(() => toPaise(NaN)).toThrow();
      expect(() => toPaise(Infinity)).toThrow();
    });
  });

  describe('toRupees', () => {
    it('converts paise bigint to rupees number', () => {
      expect(toRupees(b(0))).toBe(0);
      expect(toRupees(b(100))).toBe(1);
      expect(toRupees(b(10050))).toBe(100.5);
      expect(toRupees(b(10005))).toBe(100.05);
      expect(toRupees(b(12345678))).toBe(123456.78);
      expect(toRupees(b(-5025))).toBe(-50.25);
    });
  });

  describe('addPaise', () => {
    it('adds multiple paise amounts without floating point errors', () => {
      expect(addPaise()).toBe(b(0));
      expect(addPaise(b(100))).toBe(b(100));
      expect(addPaise(b(100), b(200), b(300))).toBe(b(600));
      expect(addPaise(b(10000000), b(5000000), b(2500000))).toBe(b(17500000));
    });

    it('handles negative values correctly', () => {
      expect(addPaise(b(500), b(-200), b(50))).toBe(b(350));
    });
  });

  describe('subtractPaise', () => {
    it('subtracts b from a exactly', () => {
      expect(subtractPaise(b(500), b(200))).toBe(b(300));
      expect(subtractPaise(b(200), b(500))).toBe(b(-300));
      expect(subtractPaise(b(0), b(0))).toBe(b(0));
    });
  });

  describe('multiplyRate', () => {
    it('calculates standard GST rates exactly', () => {
      const taxable = toPaise(10000); // ₹10,000 = 1,000,000 paise
      expect(multiplyRate(taxable, 18)).toBe(b(180000)); // 18% = ₹1,800
      expect(multiplyRate(taxable, 12)).toBe(b(120000)); // 12% = ₹1,200
      expect(multiplyRate(taxable, 5)).toBe(b(50000));   // 5% = ₹500
      expect(multiplyRate(taxable, 0)).toBe(b(0));       // 0% = ₹0
      expect(multiplyRate(taxable, 28)).toBe(b(280000)); // 28% = ₹2,800
    });

    it('handles fractional percentage rates', () => {
      const taxable = toPaise(10000); // 1,000,000 paise
      expect(multiplyRate(taxable, 2.5)).toBe(b(25000)); // 2.5% = ₹250
      expect(multiplyRate(taxable, 0.1)).toBe(b(1000));  // 0.1% = ₹10
      expect(multiplyRate(taxable, 0.25)).toBe(b(2500)); // 0.25% = ₹25
      expect(multiplyRate(taxable, 0.125)).toBe(b(1250));
    });

    it('applies exact half-up rounding on fractional paise', () => {
      // 250 paise * 5% = 12.5 paise -> rounds half-up to 13 paise
      expect(multiplyRate(b(250), 5)).toBe(b(13));

      // 248 paise * 5% = 12.4 paise -> rounds to 12 paise
      expect(multiplyRate(b(248), 5)).toBe(b(12));

      // 252 paise * 5% = 12.6 paise -> rounds to 13 paise
      expect(multiplyRate(b(252), 5)).toBe(b(13));

      // 333 paise * 18% = 59.94 paise -> rounds to 60 paise
      expect(multiplyRate(b(333), 18)).toBe(b(60));
    });

    it('handles negative amounts symmetrically', () => {
      expect(multiplyRate(b(-250), 5)).toBe(b(-13));
      expect(multiplyRate(b(-248), 5)).toBe(b(-12));
    });
  });

  describe('roundToRupee', () => {
    it('rounds paise to nearest whole rupee in paise', () => {
      expect(roundToRupee(b(10000))).toBe(b(10000));
      expect(roundToRupee(b(10049))).toBe(b(10000));
      expect(roundToRupee(b(10050))).toBe(b(10100));
      expect(roundToRupee(b(10051))).toBe(b(10100));
      expect(roundToRupee(b(10099))).toBe(b(10100));
      expect(roundToRupee(b(0))).toBe(b(0));
      expect(roundToRupee(b(49))).toBe(b(0));
      expect(roundToRupee(b(50))).toBe(b(100));
    });

    it('handles negative paise amounts', () => {
      expect(roundToRupee(b(-10049))).toBe(b(-10000));
      expect(roundToRupee(b(-10050))).toBe(b(-10100));
      expect(roundToRupee(b(-50))).toBe(b(-100));
    });
  });

  describe('formatINR', () => {
    it('formats Indian numbering system with default showPaise: true', () => {
      expect(formatINR(100000)).toBe('₹1,00,000.00');
      expect(formatINR(123456.78)).toBe('₹1,23,456.78');
      expect(formatINR('123456.78')).toBe('₹1,23,456.78');
      expect(formatINR(b(12345678))).toBe('₹1,23,456.78');
      expect(formatINR(b(10000000))).toBe('₹1,00,000.00');
    });

    it('formats edge values across different scales', () => {
      expect(formatINR(0)).toBe('₹0.00');
      expect(formatINR(5)).toBe('₹5.00');
      expect(formatINR(50)).toBe('₹50.00');
      expect(formatINR(500)).toBe('₹500.00');
      expect(formatINR(1000)).toBe('₹1,000.00');
      expect(formatINR(10000)).toBe('₹10,000.00');
      expect(formatINR(1000000)).toBe('₹10,00,000.00'); // 10 Lakhs
      expect(formatINR(10000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });

    it('formats with showPaise: false and rounds to nearest rupee', () => {
      expect(formatINR(100000, { showPaise: false })).toBe('₹1,00,000');
      expect(formatINR(123456.78, { showPaise: false })).toBe('₹1,23,457');
      expect(formatINR(123456.49, { showPaise: false })).toBe('₹1,23,456');
      expect(formatINR(b(12345678), { showPaise: false })).toBe('₹1,23,457');
      expect(formatINR(0, { showPaise: false })).toBe('₹0');
    });

    it('formats negative amounts with leading minus sign', () => {
      expect(formatINR(-100000)).toBe('-₹1,00,000.00');
      expect(formatINR(-123456.78)).toBe('-₹1,23,456.78');
      expect(formatINR(b(-12345678))).toBe('-₹1,23,456.78');
      expect(formatINR(-123456.78, { showPaise: false })).toBe('-₹1,23,457');
    });
  });
});
