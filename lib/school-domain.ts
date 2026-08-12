/**
 * The only email domain that may hold an account.
 *
 * Enforcement lives in the database (see the enforce_school_email_domain
 * migration) — everything here is UX, so people find out before submitting a
 * form rather than after. Keep this in step with the constant in that
 * migration; the database is the one that decides.
 */
export const SCHOOL_EMAIL_DOMAIN = "fusdk12.net";

/** Everything after the last `@`, lowercased. Mirrors the SQL check. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isSchoolEmail(email: string): boolean {
  return emailDomain(email.trim()) === SCHOOL_EMAIL_DOMAIN;
}

export const SCHOOL_EMAIL_ERROR = `Use your @${SCHOOL_EMAIL_DOMAIN} school email address.`;
