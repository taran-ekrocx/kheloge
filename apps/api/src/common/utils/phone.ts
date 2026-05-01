/**
 * Normalizes an Indian mobile number to E.164 format (+91XXXXXXXXXX).
 * Handles: 10-digit, 91-prefixed 12-digit, and already-formatted +91 numbers.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return raw;
}
