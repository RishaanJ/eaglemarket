# EagleMarket security

EagleMarket uses play tokens with no cash value. Security reports should be submitted through
GitHub's private vulnerability reporting for this repository. Please do not include student data,
credentials, access tokens, or exploit details in a public issue.

## Enforced in the application

- Supabase Row Level Security isolates wallets, trades, positions, settlements, and transactions by user.
- Privileged market operations re-check the caller's active admin role inside the database.
- Trades are idempotent, serialized per user, bounded to 10,000 EAG, and rate-limited in Postgres.
- The trade API rejects oversized, malformed, cross-origin, and cross-site requests.
- OAuth callbacks accept only an allowlist of local application routes.
- Security headers deny framing, MIME sniffing, unnecessary browser permissions, and cross-origin resource use.
- Secrets, local Supabase state, OAuth credentials, private keys, and deployment metadata are ignored by Git.

## Required production controls

These controls live in provider dashboards and cannot be guaranteed by repository code:

1. In Supabase Auth, enable leaked-password protection and CAPTCHA. Disable email/password sign-up if Google is the only intended provider.
2. Before inviting students, enforce the American High School email domain with a Supabase before-user-created hook or invitation allowlist. Google’s `hd` hint alone is not authorization.
3. Keep only exact production and local callback URLs in the Supabase redirect allowlist and Google OAuth client.
4. Put the deployment behind Vercel Firewall or Cloudflare WAF, enable managed DDoS protection, and add an IP-level rate limit for `/api/trades` and `/auth/*`.
5. Never expose a Supabase secret/service-role key through a `NEXT_PUBLIC_` variable. Rotate any credential immediately if it enters Git history, logs, screenshots, or chat.
6. Require MFA for Supabase, GitHub, Google Cloud, and deployment-provider administrator accounts.
7. Review Supabase Security Advisor, dependency audit results, database logs, and admin audit events before each public release.

## Incident response

If abuse or credential exposure is suspected: disable affected accounts, revoke sessions and keys,
pause market creation/trading if necessary, preserve provider logs, rotate credentials, and only then
restore service after the root cause is fixed. Deleting a Supabase user alone does not invalidate all
existing access tokens.
