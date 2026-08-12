const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_URL_LENGTH = 2048;

/**
 * Returns `value` if it is a well-formed http(s) URL, otherwise null.
 *
 * `markets.resolution_source_url` is admin-supplied free text and is stored
 * without validation, so anything rendering it as a link has to check the
 * scheme first. `new URL()` alone is not enough — it parses
 * `javascript:alert(1)` quite happily and reports the protocol as
 * `javascript:` — so the protocol allowlist is the part doing the work here.
 *
 * React does not escape this for you: a `javascript:` value in an `href`
 * executes on click.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Relative or malformed values land here. A resolution source has to be a
    // link somebody can actually follow, so there is nothing to salvage.
    return null;
  }

  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
}
