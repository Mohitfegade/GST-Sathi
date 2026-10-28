/**
 * Official GSTN State Codes (01 to 38, 97, 99).
 * Source: Goods and Services Tax Network (GSTN) Government of India.
 */

export interface StateCode {
  code: string;
  name: string;
}

export const STATE_CODES: StateCode[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Centre Jurisdiction' },
];

export const STATE_CODE_MAP: Record<string, string> = Object.freeze(
  STATE_CODES.reduce<Record<string, string>>((acc, curr) => {
    acc[curr.code] = curr.name;
    return acc;
  }, {})
);

/**
 * Retrieves the state name for a given 2-digit GST state code.
 * Accepts code with or without leading zero (e.g., '7' or '07').
 */
export function getStateName(code: string): string | null {
  if (!code || typeof code !== 'string') {
    return null;
  }
  const trimmed = code.trim();
  const directMatch = STATE_CODE_MAP[trimmed];
  if (directMatch) {
    return directMatch;
  }
  if (trimmed.length === 1) {
    return STATE_CODE_MAP[trimmed.padStart(2, '0')] ?? null;
  }
  return null;
}
