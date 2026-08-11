# CI/CD

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request targeting `main`, and on
pushes to `main` so the default branch always carries a status.

| Step | Command | Fails the PR on |
| --- | --- | --- |
| Lint | `npm run lint` | any ESLint error |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | any type error |
| Build | `npm run build` | any Next.js build or prerender error |
| Test | `npm test` | test failure (skipped while no `test` script exists) |

Every check runs even when an earlier one fails, so a single run reports all
problems rather than only the first. Runs are cancelled when a newer commit is
pushed to the same PR.

### Why CI sets Supabase env vars

`npm run build` prerenders `/markets`, and `lib/use-market.ts` constructs a
Supabase browser client at module scope while it does. Without
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` the client
throws and the build fails.

CI does not talk to a real Supabase project, so the workflow falls back to
well-formed placeholders. To build against a real instance instead, set these as
repository secrets (Settings → Secrets and variables → Actions) and the workflow
picks them up automatically:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

## Branch protection for `main`

This requires **admin** on the repository. Repo admin (`RishaanJ`) must apply it —
collaborators with push access cannot.

Settings → Branches → Add branch ruleset, targeting `main`:

- [x] Require a pull request before merging
  - Required approvals: **1**
  - [x] Dismiss stale approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required check: **`Lint, typecheck, build`**
- [x] Block force pushes
- [x] Restrict deletions

The status check only appears in the picker after the workflow has run at least
once, so merge this PR (or let its CI run) before configuring the ruleset.

Equivalent via the API, run by an admin:

```bash
gh api -X PUT repos/RishaanJ/eaglemarket/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Lint, typecheck, build' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

## Continuous deployment (Vercel)

CD is Vercel's Git integration — no deploy step belongs in the Actions workflow:

- **Preview deploy** per pull request, on every push to the PR branch.
- **Production deploy** on merge to `main`.

Connect at vercel.com → Add New → Project → import `RishaanJ/eaglemarket`.
Defaults are correct for Next.js; no `vercel.json` is needed.

### Environment variables

The application reads exactly three environment variables. All are
`NEXT_PUBLIC_`, meaning they are inlined into the client bundle and are **not**
secrets — but they still belong in Vercel's project settings, never in the repo.

| Variable | Scope | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production, Preview, Development | Cloudflare → Turnstile → your widget |

Two notes that differ from the usual checklist:

**There is no service-role key, and there should not be one.** No file in the
app references `SUPABASE_SERVICE_ROLE_KEY`. Privileged work happens inside
`security definer` Postgres functions (`submit_trade`, `admin_*`) behind RLS, so
the server never needs to bypass RLS. Introducing a service-role key into this
app would be a security regression, not a missing configuration.

**The Turnstile *secret* key does not go in Vercel.** The client obtains a
captcha token and hands it to Supabase Auth as `options.captchaToken`
(`app/auth/page.tsx`). Supabase performs the `/siteverify` exchange server-side,
so the secret is configured in Supabase → Authentication → Attack Protection →
CAPTCHA. Only the *site* key belongs in Vercel.

### Verification status

Vercel configuration could not be verified from this checkout: the repo is not
linked (`.vercel/` absent) and the Vercel CLI is not installed on this machine.
Confirm the three variables above are present for Production **and** Preview —
a preview deploy with missing variables fails at build for the same prerender
reason CI does.

The repository itself is clean: no `.env` file has ever been committed on any
branch, and no credential material appears in tracked files.
