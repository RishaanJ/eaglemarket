/**
 * Validation for the post-login `?next=` destination.
 *
 * Redirecting to a caller-supplied `next` is an open-redirect sink: with no
 * validation, `/auth?next=https://evil.com` turns the login page into a
 * phishing hop that looks like it came from us. So this never returns anything
 * but a known-good relative path on our own origin.
 *
 * The rules, in order of how they get abused:
 *
 * - Must begin with a single `/`. `//evil.com` is protocol-relative and
 *   navigates off-origin, so a second leading slash is rejected.
 * - No backslashes anywhere. Browsers normalise `\` to `/` in URLs, so
 *   `/\evil.com` is off-origin in practice even though it does not look it.
 * - No control characters, which can be used to smuggle past naive checks.
 * - Parsed against a throwaway origin and confirmed to still be on it, so a
 *   scheme that slipped through the string checks cannot survive.
 * - Finally, an allowlist. Any path not explicitly known is replaced with the
 *   default rather than followed.
 *
 * The allowlist is deliberately stricter than "any same-origin path": these
 * are the only destinations the app ever needs to send someone to after login.
 */
const STATIC_DESTINATIONS = new Set([
  "/markets",
  "/picks",
  "/rankings",
  "/settings",
  "/admin",
]);

// Per-market detail pages, e.g. /markets/will-ahs-win-friday-12. Slug
// characters only and a single segment, so a shared link to a specific market
// survives the login round trip without widening this into "any path under
// /markets".
const MARKET_DETAIL_PATTERN = /^\/markets\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DEFAULT_NEXT_PATH = "/markets";

/** C0 controls and DEL. Written as codepoints so no raw control bytes or
 *  fragile escapes end up in this file. */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_NEXT_PATH;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (value.includes("\\")) return DEFAULT_NEXT_PATH;
  if (hasControlCharacters(value)) return DEFAULT_NEXT_PATH;

  let pathname: string;
  try {
    const base = new URL("https://eaglemarket.invalid");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return DEFAULT_NEXT_PATH;
    pathname = destination.pathname;
  } catch {
    return DEFAULT_NEXT_PATH;
  }

  if (STATIC_DESTINATIONS.has(pathname)) return pathname;
  if (MARKET_DETAIL_PATTERN.test(pathname)) return pathname;

  return DEFAULT_NEXT_PATH;
}
