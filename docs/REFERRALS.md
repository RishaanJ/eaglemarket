# Referral program

Both sides receive **250 EAG** when a referred account confirms a school email
and places its first trade.

## Switching it on

The program ships **inert**. The domain allowlist is seeded empty, and an empty
allowlist pays nobody — failing closed is deliberate for a gate that mints
currency. Nothing is paid until an administrator runs:

```sql
select public.admin_set_referral_domains(array['fusdk12.net']);
```

Off switch:

```sql
select public.admin_set_referral_domains(array[]::text[]);
```

Both require an admin role; the RPC raises `42501` for anyone else.

**Do not run this until the referral migration is live on production.**

### On the scope of `fusdk12.net`

That is Fremont Unified's student email domain, shared district-wide. The gate
therefore admits every real FUSD student, not only American High School. This is
intended: an email domain cannot distinguish one campus from another, and
district-wide is the correct scope. If the product ever needs to be AHS-only,
the campus check has to come from somewhere other than the email domain.

## What the gate actually defends against

There is **no identity check in this application**. Signup confirms an inbox —
any inbox. Google sign-in accepts any Google account. There is no
`hd` parameter and no server-side domain check on the OAuth path. So a confirmed
email proves inbox control, not that someone is a student.

The bonus mints EAG, and the leaderboard sorts on portfolio value, so the threat
is rank farming rather than casual abuse. Four independent defences, because
each one alone leaks:

| Defence | What it stops |
| --- | --- |
| Domain allowlist | Signups from outside the district |
| Email normalisation | `student+1@`, `stu.dent@` — one inbox minting repeatedly |
| First-trade trigger | Drive-by signup farming that never engages |
| Rank exclusion | The payoff itself |

**The rank exclusion is the load-bearing one.** Referral EAG is recorded in
`wallets.referral_earned` and subtracted from `portfolio_value` in
`get_rankings`, floored at zero. The bonus is spendable but buys no leaderboard
position. Everything above raises the *cost* of farming; this removes the
*prize*, and it holds no matter how weak the identity check is.

`lifetime_earned` is never written by a referral. It is the ranking tiebreaker,
and a mintable tiebreaker is the same vector one layer down — the same reason
sells do not credit it.

Per-referrer cap: **5 paid referrals** (1250 EAG maximum). With the rank
exclusion in place this is belt-and-braces rather than load-bearing.

## Where the money is minted

`private.credit_referral(uuid)`, `security definer`, with execute revoked from
`public`, `anon` and `authenticated`. There is no path from a client session to
it; a student calling it gets `42501`. It runs only from a trigger on
`public.trades`.

The credit is wrapped so a referral can never take a trade down with it: any
error raises a `WARNING`, the referral stays `pending`, and the next trade
retries.

Mutual pairs (A refers B, B refers A) are refused when the referral is linked.
Beyond being obvious collusion, it is the one cycle where two concurrent credits
could deadlock over each other's wallet.

`supabase/tests/referral_test.sql` asserts all of the above, including nine
separate attempts to reach the mint path from a student session.

## How a code reaches the database

Automatically, from user metadata — not from manual entry. A user who trades
before ever "entering a code" would otherwise fire the trigger with nothing to
match and never be paid.

- **Email signup** puts the code in `options.data.referral_code`.
- **Google sign-in** carries it on the callback URL, which Google returns
  intact, and the callback route writes it with `updateUser` after the exchange.
- The `auth.users` trigger fires on **INSERT or UPDATE** of `raw_user_meta_data`,
  so both arrival times are covered.

## Tables

`referral_codes`, `referrals`, `referral_allowed_domains`, plus
`wallets.referral_earned`. RLS on all three tables, `select` only for
`authenticated`; every write goes through a definer function.

**Nothing was added to `public.profiles`.** Its column-scoped grant
`grant update (display_name, avatar_url, graduation_year)` is the only thing
preventing `role = 'admin'` self-promotion, and widening it would undo that. Any
future referral column belongs in these tables, not there.
