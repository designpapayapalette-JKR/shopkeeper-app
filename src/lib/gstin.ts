// Mirrors shopkeeper-api's src/utils/gstin.ts — structural format check
// only (2-digit state code + 10-char PAN + entity digit + "Z" + checksum),
// not a live GST-portal lookup. Empty string is always valid (GSTIN is
// optional — many shops are legitimately below the registration threshold).
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(value: string): boolean {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return true;
  return GSTIN_REGEX.test(trimmed);
}
