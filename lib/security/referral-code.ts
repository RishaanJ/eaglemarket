/**
 * Validation for a referral code arriving from a URL.
 *
 * Codes are generated from an unambiguous alphabet (no O/0, no I/1) so one
 * read off a screen or said out loud still resolves. Anything that is not
 * exactly that shape is dropped rather than passed on: the value ends up in
 * user metadata and is matched against a lookup, so the allowlist keeps
 * arbitrary caller-supplied text out of both.
 *
 * Mirrors the shape check in the database, which is the actual authority —
 * this is here so a malformed code never reaches the signup call at all.
 */
const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function safeReferralCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** The query parameter a referral link carries, e.g. /auth?ref=ABCD2345 */
export const REFERRAL_QUERY_PARAM = "ref";
