import type { NextRequest } from "next/server";

/**
 * Same-origin enforcement for state-changing requests.
 *
 * Supabase auth cookies are SameSite=Lax, which already blocks cross-site
 * POSTs, but Lax is a browser default rather than a guarantee we control — so
 * mutating routes assert it themselves. Two independent signals are checked:
 *
 * - `Sec-Fetch-Site`, set by the browser and unforgeable by page JavaScript.
 *   `none` means the user typed the URL or used a bookmark; `same-origin`
 *   means our own page issued it. Anything else is rejected.
 * - `Origin`, compared against the request's own origin, as a fallback for
 *   clients that do not send Sec-Fetch-Site.
 *
 * Both headers are absent on non-browser clients (curl, server-to-server), and
 * both are therefore treated as "not disallowed" when missing. That is
 * deliberate: this guard defends browser-driven CSRF, and authentication is
 * what defends everything else. It is not a substitute for authorization.
 *
 * DO NOT apply this to OAuth callbacks, email confirmation links, or third
 * party webhooks. Those legitimately arrive cross-site and will break. See
 * `docs/SECURITY-AUDIT.md` for what protects those routes instead.
 */
export type OriginCheckFailure = {
  message: string;
  status: 403;
};

export function checkSameOrigin(request: NextRequest): OriginCheckFailure | null {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { message: "Cross-site requests are not allowed.", status: 403 };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        return { message: "Cross-origin requests are not allowed.", status: 403 };
      }
    } catch {
      return { message: "Invalid request origin.", status: 403 };
    }
  }

  return null;
}
