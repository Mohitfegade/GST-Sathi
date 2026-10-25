import { describe, it, expect } from 'vitest';
import {
  parseFp,
  formatFp,
  getFinancialYear,
  getGstr1DueDate,
  getGstr3bDueDate,
  getGstr2bArrivalDate,
} from '../period';

describe('period utilities', () => {
  describe('parseFp', () => {
    it('parses valid return period MMYYYY strings', () => {
      expect(parseFp('042026')).toEqual({
        month: 4,
        year: 2026,
        monthName: 'April',
      });

      expect(parseFp('122025')).toEqual({
        month: 12,
        year: 2025,
        monthName: 'December',
      });

      expect(parseFp('012027')).toEqual({
        month: 1,
        year: 2027,
        monthName: 'January',
      });

      expect(parseFp('032026')).toEqual({
        month: 3,
        year: 2026,
        monthName: 'March',
      });
    });

    it('throws errors for invalid format or month', () => {
      expect(() => parseFp('')).toThrow(/Invalid fp format/);
      expect(() => parseFp('42026')).toThrow(/Invalid fp format/);
      expect(() => parseFp('0420267')).toThrow(/Invalid fp format/);
      expect(() => parseFp('abcdef')).toThrow(/Invalid fp format/);
      expect(() => parseFp('002026')).toThrow(/Invalid month/);
      expect(() => parseFp('132026')).toThrow(/Invalid month/);
    });
  });

  describe('formatFp', () => {
    it('formats month and year into 6-digit MMYYYY string', () => {
      expect(formatFp(4, 2026)).toBe('042026');
      expect(formatFp(12, 2026)).toBe('122026');
      expect(formatFp(1, 2027)).toBe('012027');
      expect(formatFp(10, 2025)).toBe('102025');
    });

    it('throws errors for invalid arguments', () => {
      expect(() => formatFp(0, 2026)).toThrow(/Invalid month/);
      expect(() => formatFp(13, 2026)).toThrow(/Invalid month/);
      expect(() => formatFp(4, -1)).toThrow(/Invalid year/);
    });
  });

  describe('getFinancialYear', () => {
    it('computes correct FY across March and April transitions', () => {
      // April starts the new FY
      expect(getFinancialYear('042026')).toBe('2026-27');
      expect(getFinancialYear('052026')).toBe('2026-27');
      expect(getFinancialYear('122026')).toBe('2026-27');

      // Jan-Mar belongs to the previous calendar year start
      expect(getFinancialYear('012027')).toBe('2026-27');
      expect(getFinancialYear('022027')).toBe('2026-27');
      expect(getFinancialYear('032027')).toBe('2026-27');

      // Next April starts 2027-28
      expect(getFinancialYear('042027')).toBe('2027-28');

      // Preceding Jan belongs to 2025-26
      expect(getFinancialYear('012026')).toBe('2025-26');
      expect(getFinancialYear('032026')).toBe('2025-26');
    });
  });

  describe('getGstr1DueDate', () => {
    it('calculates regular scheme due date as 11th of subsequent month', () => {
      // April 2026 -> May 11, 2026
      const aprDue = getGstr1DueDate('042026', 'regular');
      expect(aprDue.getFullYear()).toBe(2026);
      expect(aprDue.getMonth()).toBe(4); // May (0-indexed)
      expect(aprDue.getDate()).toBe(11);

      // December 2026 -> January 11, 2027
      const decDue = getGstr1DueDate('122026', 'regular');
      expect(decDue.getFullYear()).toBe(2027);
      expect(decDue.getMonth()).toBe(0); // January
      expect(decDue.getDate()).toBe(11);
    });

    it('calculates QRMP scheme due date as 13th of month following the quarter', () => {
      // Q1 (Apr-Jun 2026) -> July 13, 2026
      const q1Due = getGstr1DueDate('062026', 'qrmp');
      expect(q1Due.getFullYear()).toBe(2026);
      expect(q1Due.getMonth()).toBe(6); // July
      expect(q1Due.getDate()).toBe(13);

      // Also for any month within Q1
      const q1AprDue = getGstr1DueDate('042026', 'qrmp');
      expect(q1AprDue.getFullYear()).toBe(2026);
      expect(q1AprDue.getMonth()).toBe(6);
      expect(q1AprDue.getDate()).toBe(13);

      // Q2 (Jul-Sep 2026) -> October 13, 2026
      const q2Due = getGstr1DueDate('092026', 'qrmp');
      expect(q2Due.getFullYear()).toBe(2026);
      expect(q2Due.getMonth()).toBe(9); // October
      expect(q2Due.getDate()).toBe(13);

      // Q3 (Oct-Dec 2026) -> January 13, 2027
      const q3Due = getGstr1DueDate('122026', 'qrmp');
      expect(q3Due.getFullYear()).toBe(2027);
      expect(q3Due.getMonth()).toBe(0); // January
      expect(q3Due.getDate()).toBe(13);

      // Q4 (Jan-Mar 2027) -> April 13, 2027
      const q4Due = getGstr1DueDate('032027', 'qrmp');
      expect(q4Due.getFullYear()).toBe(2027);
      expect(q4Due.getMonth()).toBe(3); // April
      expect(q4Due.getDate()).toBe(13);
    });
  });

  describe('getGstr3bDueDate', () => {
    it('calculates regular scheme due date as 20th of subsequent month', () => {
      // April 2026 -> May 20, 2026
      const aprDue = getGstr3bDueDate('042026', 'regular');
      expect(aprDue.getFullYear()).toBe(2026);
      expect(aprDue.getMonth()).toBe(4); // May
      expect(aprDue.getDate()).toBe(20);

      // December 2026 -> January 20, 2027
      const decDue = getGstr3bDueDate('122026', 'regular');
      expect(decDue.getFullYear()).toBe(2027);
      expect(decDue.getMonth()).toBe(0); // January
      expect(decDue.getDate()).toBe(20);
    });

    it('calculates QRMP Category 1 state due date as 22nd of month following quarter', () => {
      // Maharashtra (27) for Q1 (Jun 2026) -> July 22, 2026
      const mhDue = getGstr3bDueDate('062026', 'qrmp', '27');
      expect(mhDue.getFullYear()).toBe(2026);
      expect(mhDue.getMonth()).toBe(6); // July
      expect(mhDue.getDate()).toBe(22);

      // Gujarat (24) -> July 22, 2026
      const gjDue = getGstr3bDueDate('062026', 'qrmp', '24');
      expect(gjDue.getDate()).toBe(22);

      // Karnataka (29) -> July 22, 2026
      const kaDue = getGstr3bDueDate('062026', 'qrmp', '29');
      expect(kaDue.getDate()).toBe(22);

      // Tamil Nadu (33) -> July 22, 2026
      const tnDue = getGstr3bDueDate('062026', 'qrmp', '33');
      expect(tnDue.getDate()).toBe(22);

      // Default (when stateCode is omitted) defaults to 22nd
      const defaultDue = getGstr3bDueDate('062026', 'qrmp');
      expect(defaultDue.getDate()).toBe(22);

      // Full GSTIN input handling (e.g. 27AAPFU0939F1ZV)
      const gstinDue = getGstr3bDueDate('062026', 'qrmp', '27AAPFU0939F1ZV');
      expect(gstinDue.getDate()).toBe(22);
    });

    it('calculates QRMP Category 2 state due date as 24th of month following quarter', () => {
      // Delhi (07) for Q1 (Jun 2026) -> July 24, 2026
      const dlDue = getGstr3bDueDate('062026', 'qrmp', '07');
      expect(dlDue.getFullYear()).toBe(2026);
      expect(dlDue.getMonth()).toBe(6); // July
      expect(dlDue.getDate()).toBe(24);

      // Uttar Pradesh (09) -> July 24, 2026
      const upDue = getGstr3bDueDate('062026', 'qrmp', '09');
      expect(upDue.getDate()).toBe(24);

      // Punjab (03) -> July 24, 2026
      const pbDue = getGstr3bDueDate('062026', 'qrmp', '03');
      expect(pbDue.getDate()).toBe(24);

      // Rajasthan (08) -> July 24, 2026
      const rjDue = getGstr3bDueDate('062026', 'qrmp', '08');
      expect(rjDue.getDate()).toBe(24);

      // West Bengal (19) for Q3 (Dec 2026) -> January 24, 2027
      const wbDue = getGstr3bDueDate('122026', 'qrmp', '19');
      expect(wbDue.getFullYear()).toBe(2027);
      expect(wbDue.getMonth()).toBe(0); // January
      expect(wbDue.getDate()).toBe(24);
    });
  });

  describe('getGstr2bArrivalDate', () => {
    it('calculates GSTR-2B arrival date as 14th of subsequent month', () => {
      // April 2026 -> May 14, 2026
      const aprArrival = getGstr2bArrivalDate('042026');
      expect(aprArrival.getFullYear()).toBe(2026);
      expect(aprArrival.getMonth()).toBe(4); // May
      expect(aprArrival.getDate()).toBe(14);

      // December 2026 -> January 14, 2027
      const decArrival = getGstr2bArrivalDate('122026');
      expect(decArrival.getFullYear()).toBe(2027);
      expect(decArrival.getMonth()).toBe(0); // January
      expect(decArrival.getDate()).toBe(14);

      // February 2027 -> March 14, 2027
      const febArrival = getGstr2bArrivalDate('022027');
      expect(febArrival.getFullYear()).toBe(2027);
      expect(febArrival.getMonth()).toBe(2); // March
      expect(febArrival.getDate()).toBe(14);
    });
  });
});
