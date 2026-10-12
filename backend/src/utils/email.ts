/** Canonical form of an e-mail address for storage and lookup: trimmed, lower-cased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
