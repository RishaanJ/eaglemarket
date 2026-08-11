# Security audit

Scope: response headers, CSRF, XSS, injection, and authorization. Findings are
recorded here so later changes can tell what was verified and what was
deliberately left alone.

## 1. Response headers

All required headers were **already present** in `next.config.ts` before this
audit, applied to `/:path*`:

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Frame-Options` | `DENY` (plus `frame-ancestors 'none'` in the CSP) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Origin-Agent-Cluster` | `?1` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `X-DNS-Prefetch-Control` | `off` |

`poweredByHeader` is disabled. No changes were needed.

## 2. Content Security Policy

Both foreign origins the roadmap needs are now in place, so later work does not
have to reopen this file:

- **`frame-src https://tally.so`** — the embedded student market-request form.
  Only the iframe is allowed. Tally's auto-resize *widget script* is
  intentionally **not** added to `script-src`, so the embed must be a plain
  fixed-height iframe. Adding a third-party script origin would materially
  weaken the policy for a cosmetic benefit.
- **`connect-src wss://*.supabase.co`** — Supabase realtime rides a websocket.
  This was already present and is load-bearing: live price sync and market
  freeze notifications both stop working if it is narrowed to `https://` alone,
  and they fail *silently*, with no console error on the happy path.

### Known weaknesses, accepted for now

- **`script-src 'unsafe-inline'`.** Next.js emits inline bootstrap scripts. The
  strict fix is a per-request nonce issued from `proxy.ts`, but a nonce forces
  every page to render dynamically, which would remove static prerendering from
  the seven currently-static routes. Deferred deliberately rather than
  overlooked.
- **`img-src https:`** allows any HTTPS image host, because `profiles.avatar_url`
  is user-controlled and may point anywhere. Tightening this requires deciding
  on an avatar hosting story first.

## 3. CSRF

Every route handler and server action in the repository, and what guards it:

| Route | Method | Mutating | Guard |
| --- | --- | --- | --- |
| `app/api/trades/route.ts` | POST | yes | `checkSameOrigin` (`Sec-Fetch-Site` + `Origin`) |
| `app/auth/callback/route.ts` | GET | yes (creates a session) | PKCE — see below |
| `app/auth/confirm/route.ts` | GET | yes (creates a session) | one-time token hash — see below |

**Server actions: none exist.** Nothing in `app/`, `lib/`, or `components/`
carries a `"use server"` directive.

**No route was found lacking a guard it should have had.** The same-origin check
was extracted from the trades route into `lib/security/same-origin.ts` so it is
reusable and consistently applied, but its behaviour is unchanged.

### Why the two auth routes must not take the same guard

Both are state-changing GETs, and applying `checkSameOrigin` to either would
break sign-in outright:

- `/auth/callback` receives a cross-site redirect from Google, so
  `Sec-Fetch-Site: cross-site` is the *correct* value for a legitimate request.
- `/auth/confirm` is opened from an email client, arriving as `none` or
  `cross-site` depending on the client.

Their protection is structural instead, and was verified by reading the code:

- `exchangeCodeForSession` completes a **PKCE** flow. The code verifier lives in
  an httpOnly cookie set when the flow started, so an attacker who injects their
  own `code` cannot have it exchanged in the victim's browser — which is also
  what defeats login-CSRF (forcing a victim into the attacker's session).
- `verifyOtp` requires a single-use `token_hash` that only the mailbox owner has.
- `safeNextPath` in the callback allowlists redirect targets against a fixed set
  (`/markets`, `/picks`, `/rankings`, `/settings`, `/admin`), rejecting
  backslashes and control characters, so neither route is an open redirect.
- Both send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, so the
  authorization code is not leaked through the `Referer` header or a cache.

### Direct Supabase RPC calls from client components

`app/admin/admin-client.tsx`, `app/rankings/page.tsx`, and `app/picks` call
`supabase.rpc(...)` directly rather than through a route handler. These are not
CSRF-able: supabase-js sends the session as an `Authorization: Bearer` header,
which a cross-origin page cannot cause the browser to attach, and the session
cookie is scoped to this app's domain rather than Supabase's. Authorization for
these calls is enforced in the database (section 6).

## 4. XSS

- **One `dangerouslySetInnerHTML`**, at `components/ui/chart.tsx:95`. This is
  the stock shadcn `ChartStyle` component, which builds a `<style>` block from a
  chart config. Traced the data: the only `ChartConfig` in the app is
  `positionChartConfig` in `app/picks/picks-client.tsx:30`, a module-level
  literal with hardcoded keys and `oklch()` colors. The `id` is generated by
  `useId()`. **No user-controlled value reaches it.**
- No `innerHTML`, `eval`, or `new Function` anywhere in `app/`, `lib/`, or
  `components/`.
- All user-submitted text — market questions, descriptions, resolution
  criteria, resolution notes, display names, transaction notes — renders as JSX
  children, which React escapes automatically. Storing pre-escaped or sanitized
  HTML would be wrong here: the values are plain text and are never interpreted
  as markup.
- **No user value is used as an `href`, `src`, or inline `style`.** The only
  dynamic `href`s are same-page anchors in `app/privacy` and `app/terms` and
  static props on the landing page's bento grid.

### One thing to watch

`markets.resolution_source_url` is admin-supplied, stored unvalidated, and is
currently **never rendered**. The moment a market page renders it as a link, a
`javascript:` URL becomes an XSS vector. Whoever adds that link must validate
the scheme against `http:`/`https:` first.

## 5. Injection

- Every database call goes through the supabase-js query builder or `.rpc()`
  with named parameters. There is no string-concatenated SQL in the application.
- No PL/pgSQL function builds dynamic SQL: there is no `EXECUTE` with
  concatenation or `format()` in any migration.
- Every `security definer` function sets `search_path = ''` and fully qualifies
  its identifiers, which is what stops search_path hijacking.
- **RLS is enabled on all 11 tables** — `profiles`, `categories`, `markets`,
  `wallets`, `wallet_transactions`, `trades`, `positions`, `market_settlements`,
  `watchlists`, `admin_audit_log`, `market_price_history`. No table was missed.

## 6. Authorization — proven at the database

`supabase/tests/authorization_test.sql` asserts that privileged operations fail
in Postgres for a non-admin, independently of the UI. Run with `supabase test db`.

The tests act as a real logged-in student — the `authenticated` role with a JWT
claim that `auth.uid()` reads — and cover:

- All four `admin_*` RPCs raise `42501` for a student and succeed for an admin,
  so the gate discriminates on role rather than failing closed for everyone.
- `private.require_admin()` is not callable directly.
- **A student cannot promote themselves to admin.** This is the load-bearing
  check: `profiles` has a self-update RLS policy, and what actually prevents
  escalation is the column-scoped grant
  `grant update (display_name, avatar_url, graduation_year)`. If that grant ever
  widens, every admin gate above becomes bypassable.
- A student cannot resolve a market, move AMM pools, mint EAG, forge a trade or
  position row, or write to the audit log by direct DML.
- RLS hides other users' wallets and transactions and the entire audit log,
  while still allowing a student to read their own wallet.

All 19 assertions pass. They were executed against a local stack with all 14
migrations applied, inside a transaction that rolls back, so the suite is
repeatable and leaves no residue.
