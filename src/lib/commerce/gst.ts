/** GST helpers: GSTIN validation, state codes, tax split and invoice numbers. */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Validates format and the mod-36 check character of a GSTIN. */
export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  if (!GSTIN_RE.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  const check = CHARS[(36 - (sum % 36)) % 36];
  return check === g[14];
}

export const gstinState = (gstin: string) => gstin.trim().slice(0, 2);

export const TN_STATE_CODE = "33";

export interface TaxSplit {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

/**
 * Splits an amount into taxable value and GST. `inclusive` = the amount already contains GST.
 * Intra-state supply (seller and buyer both in Tamil Nadu) → CGST + SGST; otherwise IGST.
 */
export function splitTax(amountPaise: number, ratePct: number, inclusive: boolean, intraState: boolean): TaxSplit {
  let taxable: number;
  let tax: number;
  if (inclusive) {
    taxable = Math.round((amountPaise * 100) / (100 + ratePct));
    tax = amountPaise - taxable;
  } else {
    taxable = amountPaise;
    tax = Math.round((amountPaise * ratePct) / 100);
  }
  if (intraState) {
    const cgst = Math.floor(tax / 2);
    return { taxablePaise: taxable, cgstPaise: cgst, sgstPaise: tax - cgst, igstPaise: 0, totalPaise: taxable + tax };
  }
  return { taxablePaise: taxable, cgstPaise: 0, sgstPaise: 0, igstPaise: tax, totalPaise: taxable + tax };
}

/** Indian financial year label for a date, e.g. 2026-10-14 → "2026-27". */
export function financialYear(d: Date): string {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/** Invoice number, at most 16 characters as GST rules require: HL/26-27/000123 */
export function invoiceNumber(d: Date, seq: number): string {
  const fy = financialYear(d).slice(2);
  return `HL/${fy}/${String(seq).padStart(6, "0")}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

/** Amount in words, Indian numbering (lakh, crore) — printed on GST invoices. */
export function rupeesInWords(paise: number): string {
  let n = Math.floor(paise / 100);
  const p = paise % 100;
  if (n === 0 && p === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `Rupees ${parts.join(" ") || "Zero"}${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
}
