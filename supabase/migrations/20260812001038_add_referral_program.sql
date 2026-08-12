-- Referral program.
--
-- Both sides get 250 EAG when a referred account confirms a school email and
-- places its first trade. Every EAG minted here runs inside a security definer
-- function that the client cannot reach.
--
-- The threat this is built against is rank farming, not casual abuse. There is
-- no identity check in this application: signup requires confirming an inbox,
-- any inbox, and Google sign-in accepts any Google account. So the gate is
-- three independent things, because each one alone leaks:
--
--   1. Domain allowlist  — the referred email must be on a school domain.
--   2. Email normalisation — +tags and dots are stripped, so student+1@ and
--      stu.dent@ collapse to one address that can only ever be paid once.
--   3. First trade       — payment waits until the referred account has
--      actually traded, which kills drive-by signup farming.
--
-- Plus the defence that does not depend on identity at all: referral EAG is
-- tracked separately and subtracted from the leaderboard, so buying referrals
-- cannot buy rank.
--
-- Nothing is added to public.profiles. Its column-scoped UPDATE grant
-- (display_name, avatar_url, graduation_year) is the only thing preventing
-- role = 'admin' self-promotion and is deliberately left untouched.

-- ── Configuration ───────────────────────────────────────────────────────────

-- Deliberately seeded EMPTY: with no rows, no referral is ever paid. The
-- program is inert until an administrator adds the school's domain. Failing
-- closed is the right default for a gate that mints currency.
create table public.referral_allowed_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now()
);

comment on table public.referral_allowed_domains is
  'Email domains eligible for referral bonuses. EMPTY MEANS NO REFERRAL IS EVER PAID — add the school domain to switch the program on.';

alter table public.referral_allowed_domains enable row level security;

create policy referral_domains_authenticated_read
on public.referral_allowed_domains for select
to authenticated
using (true);

-- ── Referral codes ──────────────────────────────────────────────────────────

create table public.referral_codes (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);

comment on table public.referral_codes is
  'One shareable code per user. Written only by security definer functions.';

alter table public.referral_codes enable row level security;

-- A code is a public-ish handle: anyone signing up needs to resolve one. The
-- lookup happens inside a definer function, so no broad read policy is needed.
create policy referral_codes_self_read
on public.referral_codes for select
to authenticated
using (user_id = (select auth.uid()));

-- ── Referrals ───────────────────────────────────────────────────────────────

create table public.referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references public.profiles(user_id) on delete restrict,
  referred_id uuid not null unique references public.profiles(user_id) on delete restrict,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  referred_email_normalized text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint referrals_no_self check (referrer_id <> referred_id),
  constraint referrals_paid_has_timestamp check (
    (status = 'paid' and paid_at is not null and referred_email_normalized is not null)
    or (status <> 'paid' and paid_at is null)
  )
);

comment on table public.referrals is
  'One row per referred account. referred_id is unique, so an account can be referred at most once, ever.';

comment on column public.referrals.referred_email_normalized is
  'Referred email with +tag and dots stripped from the local part. Deduped across paid rows so plus-addressing cannot mint repeatedly from one inbox.';

-- The defence against student+1@, student+2@, stu.dent@ all being "new" users:
-- one paid referral per real inbox, forever. Partial so rejected and pending
-- rows never block a legitimate later payout.
create unique index referrals_paid_normalized_email_idx
  on public.referrals (referred_email_normalized)
  where status = 'paid';

create index referrals_referrer_idx on public.referrals (referrer_id, status);

alter table public.referrals enable row level security;

create policy referrals_participant_read
on public.referrals for select
to authenticated
using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));

-- Reads only. Every write goes through a definer function; there is no INSERT,
-- UPDATE or DELETE grant on either table for application roles.
revoke all on public.referral_codes from anon, authenticated;
revoke all on public.referrals from anon, authenticated;
revoke all on public.referral_allowed_domains from anon, authenticated;
revoke all on sequence public.referrals_id_seq from anon, authenticated;
grant select on public.referral_codes to authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_allowed_domains to authenticated;

-- ── Wallet: referral EAG tracked separately ─────────────────────────────────

-- Spendable like any other EAG, but subtracted from portfolio_value in
-- get_rankings so a referral can never buy leaderboard position.
alter table public.wallets
  add column if not exists referral_earned numeric(20, 4) not null default 0
    check (referral_earned >= 0);

comment on column public.wallets.referral_earned is
  'Cumulative EAG received from referral bonuses. Subtracted from portfolio_value in get_rankings so referrals cannot buy rank.';

-- ── Allow the new transaction type ──────────────────────────────────────────

alter table public.wallet_transactions
  drop constraint wallet_transactions_transaction_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_transaction_type_check
  check (transaction_type in (
    'initial_grant', 'trade', 'payout', 'refund', 'admin_adjustment', 'referral_bonus'
  ));

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Collapses the addresses one inbox can generate into a single identity.
-- Gmail and Google Workspace both ignore dots and everything after a +, so
-- treating them as distinct people is exactly the farming hole.
create or replace function private.normalize_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null or pg_catalog.strpos(p_email, '@') = 0 then null
    else
      pg_catalog.replace(
        pg_catalog.split_part(
          pg_catalog.split_part(pg_catalog.lower(pg_catalog.btrim(p_email)), '@', 1),
          '+', 1
        ),
        '.', ''
      )
      || '@'
      || pg_catalog.split_part(pg_catalog.lower(pg_catalog.btrim(p_email)), '@', 2)
  end;
$$;

revoke all on function private.normalize_email(text) from public, anon, authenticated;

-- Ambiguous characters (0/O, 1/I) are excluded so a code read aloud or copied
-- off a screen still resolves.
create or replace function private.generate_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for _ in 1..8 loop
      v_code := v_code || pg_catalog.substr(
        c_alphabet,
        1 + pg_catalog.floor(pg_catalog.random() * pg_catalog.length(c_alphabet))::int,
        1
      );
    end loop;

    exit when not exists (
      select 1 from public.referral_codes as rc where rc.code = v_code
    );

    if v_attempt >= 12 then
      raise exception 'Could not allocate a referral code' using errcode = 'P0001';
    end if;
  end loop;

  return v_code;
end;
$$;

revoke all on function private.generate_referral_code() from public, anon, authenticated;

-- ── Code issue and lookup ───────────────────────────────────────────────────

create or replace function public.get_my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select rc.code into v_code
  from public.referral_codes as rc
  where rc.user_id = v_user_id;

  if found then
    return v_code;
  end if;

  -- Serialise per user so two concurrent page loads cannot both allocate.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('referral_code:' || v_user_id::text, 0)
  );

  select rc.code into v_code
  from public.referral_codes as rc
  where rc.user_id = v_user_id;

  if found then
    return v_code;
  end if;

  v_code := private.generate_referral_code();

  insert into public.referral_codes (user_id, code)
  values (v_user_id, v_code)
  on conflict (user_id) do update set code = public.referral_codes.code
  returning code into v_code;

  return v_code;
end;
$$;

revoke all on function public.get_my_referral_code() from public, anon;
grant execute on function public.get_my_referral_code() to authenticated;

create or replace function public.get_my_referral_stats()
returns table (
  code text,
  paid_count integer,
  pending_count integer,
  referral_earned numeric,
  cap integer,
  referred_by_display_name text,
  referred_bonus_paid boolean,
  program_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    public.get_my_referral_code(),
    (select count(*)::integer from public.referrals as r
      where r.referrer_id = v_user_id and r.status = 'paid'),
    (select count(*)::integer from public.referrals as r
      where r.referrer_id = v_user_id and r.status = 'pending'),
    (select w.referral_earned from public.wallets as w where w.user_id = v_user_id),
    5,
    (select p.display_name
       from public.referrals as r
       join public.profiles as p on p.user_id = r.referrer_id
      where r.referred_id = v_user_id),
    (select r.status = 'paid' from public.referrals as r where r.referred_id = v_user_id),
    (select exists (select 1 from public.referral_allowed_domains));
end;
$$;

revoke all on function public.get_my_referral_stats() from public, anon;
grant execute on function public.get_my_referral_stats() to authenticated;

-- ── Linking a signup to its referrer ────────────────────────────────────────

-- Runs from a trigger on auth.users rather than being called by the client, so
-- a user who trades before "entering a code" is still matched. Creates a
-- pending row only; it mints nothing.
create or replace function private.link_referral_from_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_referrer uuid;
begin
  v_code := pg_catalog.upper(
    pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))
  );

  if v_code !~ '^[A-Z0-9]{8}$' then
    return new;
  end if;

  -- Already linked. referred_id is unique, so this is settled permanently.
  if exists (select 1 from public.referrals as r where r.referred_id = new.id) then
    return new;
  end if;

  select rc.user_id into v_referrer
  from public.referral_codes as rc
  where rc.code = v_code;

  if not found or v_referrer = new.id then
    return new;
  end if;

  -- Reject a mutual pair outright. Beyond being obvious collusion, A refers B
  -- and B refers A is the one cycle that could deadlock two concurrent trades
  -- when each credit needs the other's wallet.
  if exists (
    select 1 from public.referrals as r
    where r.referred_id = v_referrer and r.referrer_id = new.id
  ) then
    return new;
  end if;

  -- The profile is created by on_auth_user_created, which fires first by name
  -- ordering. If it is somehow absent the FK would abort account creation, so
  -- the referral is skipped rather than allowed to break signup.
  if not exists (select 1 from public.profiles as p where p.user_id = new.id) then
    return new;
  end if;

  insert into public.referrals (referrer_id, referred_id, code)
  values (v_referrer, new.id, v_code)
  on conflict (referred_id) do nothing;

  return new;
exception
  when others then
    -- A referral must never prevent an account from being created.
    raise warning 'Referral link skipped for %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function private.link_referral_from_metadata() from public, anon, authenticated;

-- Named to sort after on_auth_user_created so the profile row exists first.
-- Fires on UPDATE too: Google sign-in has no metadata at insert time, the code
-- arrives when the callback calls updateUser after the exchange.
create trigger on_auth_user_created_referral
after insert or update of raw_user_meta_data on auth.users
for each row execute function private.link_referral_from_metadata();

-- ── The credit ──────────────────────────────────────────────────────────────

-- Lives in private with every privilege revoked. There is no path from a
-- client session to this function: a student calling it gets 42501.
create or replace function private.credit_referral(p_referred_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_bonus constant numeric(20, 4) := 250;
  c_cap constant integer := 5;
  v_referral public.referrals%rowtype;
  v_email text;
  v_confirmed timestamptz;
  v_normalized text;
  v_domain text;
  v_paid_count integer;
  v_referrer_balance numeric;
  v_referred_balance numeric;
  v_referrer_tx bigint;
  v_referred_tx bigint;
begin
  select r.* into v_referral
  from public.referrals as r
  where r.referred_id = p_referred_id and r.status = 'pending'
  for update;

  if not found then
    return;
  end if;

  select u.email, u.email_confirmed_at
  into v_email, v_confirmed
  from auth.users as u
  where u.id = p_referred_id;

  -- Gate 1: the address must be confirmed.
  if v_confirmed is null then
    return;
  end if;

  v_normalized := private.normalize_email(v_email);
  if v_normalized is null then
    return;
  end if;

  v_domain := pg_catalog.split_part(v_normalized, '@', 2);

  -- Gate 2: the domain must be allowlisted. An empty allowlist pays nobody,
  -- which is the intended state until an administrator switches the program on.
  if not exists (
    select 1 from public.referral_allowed_domains as d where d.domain = v_domain
  ) then
    return;
  end if;

  -- Gate 3: one payout per real inbox. Enforced again by a unique index below,
  -- so a race cannot slip a second payout through.
  if exists (
    select 1 from public.referrals as r
    where r.status = 'paid' and r.referred_email_normalized = v_normalized
  ) then
    update public.referrals as r
    set status = 'rejected'
    where r.id = v_referral.id;
    return;
  end if;

  if not exists (
    select 1 from public.profiles as p
    where p.user_id = v_referral.referrer_id and p.account_status = 'active'
  ) then
    return;
  end if;

  select count(*)::integer into v_paid_count
  from public.referrals as r
  where r.referrer_id = v_referral.referrer_id and r.status = 'paid';

  if v_paid_count >= c_cap then
    update public.referrals as r
    set status = 'rejected'
    where r.id = v_referral.id;
    return;
  end if;

  -- Referrer first. The caller already holds the referred user's wallet lock
  -- inside submit_trade, and mutual pairs are refused at link time, so there is
  -- no two-party cycle to deadlock on.
  update public.wallets as w
  set balance = w.balance + c_bonus,
      referral_earned = w.referral_earned + c_bonus
  where w.user_id = v_referral.referrer_id
  returning w.balance into v_referrer_balance;

  update public.wallets as w
  set balance = w.balance + c_bonus,
      referral_earned = w.referral_earned + c_bonus
  where w.user_id = p_referred_id
  returning w.balance into v_referred_balance;

  -- lifetime_earned is deliberately NOT credited on either side. It is the
  -- get_rankings tiebreaker, and a mintable tiebreaker is a farming vector one
  -- layer below portfolio_value.

  -- Two fixed keys derived from referred_id, which is unique. A replay collides
  -- on the unique index and the bonus cannot double-pay.
  insert into public.wallet_transactions (
    user_id, transaction_type, amount, balance_after, idempotency_key, note
  )
  values (
    v_referral.referrer_id, 'referral_bonus', c_bonus, v_referrer_balance,
    'referral:' || p_referred_id::text || ':referrer',
    'Referral bonus for inviting a new student'
  )
  returning id into v_referrer_tx;

  insert into public.wallet_transactions (
    user_id, transaction_type, amount, balance_after, idempotency_key, note
  )
  values (
    p_referred_id, 'referral_bonus', c_bonus, v_referred_balance,
    'referral:' || p_referred_id::text || ':referred',
    'Welcome bonus for joining through a referral'
  )
  returning id into v_referred_tx;

  update public.referrals as r
  set status = 'paid',
      paid_at = now(),
      referred_email_normalized = v_normalized
  where r.id = v_referral.id;

  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, details)
  values (
    null,
    'referral.paid',
    'referral',
    v_referral.id::text,
    jsonb_build_object(
      'referrer_id', v_referral.referrer_id,
      'referred_id', p_referred_id,
      'bonus_each', c_bonus,
      'referrer_transaction_id', v_referrer_tx,
      'referred_transaction_id', v_referred_tx
    )
  );
end;
$$;

revoke all on function private.credit_referral(uuid) from public, anon, authenticated;

-- Gate 3 of the payout: the first trade. Firing here rather than on account
-- creation is what makes drive-by signup farming worthless.
create or replace function private.credit_referral_on_first_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.credit_referral(new.user_id);
  return new;
exception
  when others then
    -- A referral bonus must never take a trade down with it. The row stays
    -- pending and the next trade retries.
    raise warning 'Referral credit skipped for %: %', new.user_id, sqlerrm;
    return new;
end;
$$;

revoke all on function private.credit_referral_on_first_trade() from public, anon, authenticated;

create trigger trades_credit_referral
after insert on public.trades
for each row execute function private.credit_referral_on_first_trade();

-- ── Rankings: referral EAG cannot buy position ──────────────────────────────

-- Byte-for-byte the current data-minimised leaderboard apart from
-- portfolio_value, which now nets out referral_earned. The narrowed DTO from
-- the identity-minimisation migration (no user_id, no avatar_url, plus
-- is_current_user) is preserved exactly; only the money line changes.
--
-- Floored at zero so someone who spends the bonus and loses it cannot rank
-- below a user who never received one.
create or replace function public.get_rankings(result_limit integer default 50)
returns table (
  rank bigint,
  display_name text,
  graduation_year smallint,
  portfolio_value numeric,
  open_positions bigint,
  total_picks bigint,
  wins bigint,
  resolved_picks bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with authorized as (
    select profiles.user_id
    from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.account_status = 'active'
  ),
  position_totals as (
    select
      positions.user_id,
      count(*) filter (
        where markets.status = 'open'
          and (positions.yes_shares > 0 or positions.no_shares > 0)
      ) as open_positions,
      count(*) filter (
        where positions.yes_shares > 0 or positions.no_shares > 0
      ) as total_picks,
      coalesce(
        sum(
          case
            when markets.status = 'open' then
              positions.yes_shares * (markets.pool_no / (markets.pool_yes + markets.pool_no))
              + positions.no_shares * (markets.pool_yes / (markets.pool_yes + markets.pool_no))
            else 0
          end
        ),
        0
      ) as open_value
    from public.positions
    join public.markets on markets.id = positions.market_id
    group by positions.user_id
  ),
  settlement_totals as (
    select
      market_settlements.user_id,
      count(*) filter (where market_settlements.payout > 0) as wins,
      count(*) as resolved_picks
    from public.market_settlements
    group by market_settlements.user_id
  ),
  ranked as (
    select
      profiles.user_id,
      profiles.display_name,
      profiles.graduation_year,
      greatest(
        0,
        wallets.balance
          + coalesce(position_totals.open_value, 0)
          - wallets.referral_earned
      ) as portfolio_value,
      coalesce(position_totals.open_positions, 0) as open_positions,
      coalesce(position_totals.total_picks, 0) as total_picks,
      coalesce(settlement_totals.wins, 0) as wins,
      coalesce(settlement_totals.resolved_picks, 0) as resolved_picks,
      wallets.lifetime_earned
    from public.profiles
    join public.wallets on wallets.user_id = profiles.user_id
    left join position_totals on position_totals.user_id = profiles.user_id
    left join settlement_totals on settlement_totals.user_id = profiles.user_id
    cross join authorized
    where profiles.account_status = 'active'
  )
  select
    row_number() over (
      order by ranked.portfolio_value desc, ranked.lifetime_earned desc, ranked.user_id
    ) as rank,
    ranked.display_name,
    ranked.graduation_year,
    ranked.portfolio_value,
    ranked.open_positions,
    ranked.total_picks,
    ranked.wins,
    ranked.resolved_picks,
    ranked.user_id = (select auth.uid()) as is_current_user
  from ranked
  order by rank
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

comment on function public.get_rankings(integer) is
  'Returns a data-minimized leaderboard to active authenticated EagleMarket users. Referral EAG is excluded from portfolio_value.';

revoke all on function public.get_rankings(integer) from public, anon;
grant execute on function public.get_rankings(integer) to authenticated;

-- ── Admin: manage the domain allowlist ──────────────────────────────────────

create or replace function public.admin_set_referral_domains(p_domains text[])
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
  v_domain text;
begin
  delete from public.referral_allowed_domains;

  foreach v_domain in array coalesce(p_domains, array[]::text[]) loop
    v_domain := pg_catalog.lower(pg_catalog.btrim(pg_catalog.ltrim(v_domain, '@')));
    continue when v_domain = '';
    insert into public.referral_allowed_domains (domain)
    values (v_domain)
    on conflict (domain) do nothing;
  end loop;

  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, details)
  values (
    v_admin_id, 'referral.domains_updated', 'referral_allowed_domains', null,
    jsonb_build_object('domains', coalesce(p_domains, array[]::text[]))
  );

  return query select d.domain from public.referral_allowed_domains as d order by d.domain;
end;
$$;

revoke all on function public.admin_set_referral_domains(text[]) from public, anon;
grant execute on function public.admin_set_referral_domains(text[]) to authenticated;

comment on function public.admin_set_referral_domains(text[]) is
  'Replaces the referral domain allowlist. Passing an empty array switches the referral program off.';
