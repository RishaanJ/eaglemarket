-- EagleMarket core schema
-- Single-school deployment for American High School.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  graduation_year smallint check (graduation_year between 2020 and 2100),
  role text not null default 'student' check (role in ('student', 'moderator', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 1 and 40),
  color text not null default '#0b84bb' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_key text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.markets (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id) on delete restrict,
  question text not null check (char_length(question) between 10 and 240),
  description text,
  resolution_criteria text not null check (char_length(resolution_criteria) between 10 and 2000),
  resolution_source_url text,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'resolved', 'cancelled')),
  resolved_outcome text check (resolved_outcome in ('yes', 'no')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  resolved_at timestamptz,
  pool_yes numeric(28, 8) not null default 1000 check (pool_yes > 0),
  pool_no numeric(28, 8) not null default 1000 check (pool_no > 0),
  total_volume numeric(20, 4) not null default 0 check (total_volume >= 0),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  resolved_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markets_open_close_order check (opens_at < closes_at),
  constraint markets_resolution_state check (
    (status = 'resolved' and resolved_outcome is not null and resolved_at is not null and resolved_by is not null)
    or
    (status <> 'resolved' and resolved_outcome is null and resolved_at is null)
  )
);

create table public.wallets (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  balance numeric(20, 4) not null default 0 check (balance >= 0),
  lifetime_earned numeric(20, 4) not null default 0 check (lifetime_earned >= 0),
  lifetime_spent numeric(20, 4) not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.wallets(user_id) on delete cascade,
  market_id bigint references public.markets(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('initial_grant', 'trade', 'payout', 'refund', 'admin_adjustment')),
  amount numeric(20, 4) not null check (amount <> 0),
  balance_after numeric(20, 4) not null check (balance_after >= 0),
  idempotency_key text unique,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.trades (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  wallet_transaction_id bigint not null unique references public.wallet_transactions(id) on delete restrict,
  outcome text not null check (outcome in ('yes', 'no')),
  token_amount numeric(20, 4) not null check (token_amount > 0),
  shares_received numeric(28, 8) not null check (shares_received > 0),
  average_price numeric(9, 8) not null check (average_price > 0 and average_price <= 1),
  probability_before numeric(9, 8) not null check (probability_before >= 0 and probability_before <= 1),
  probability_after numeric(9, 8) not null check (probability_after >= 0 and probability_after <= 1),
  price_impact numeric(12, 8) not null check (price_impact >= 0),
  pool_yes_before numeric(28, 8) not null check (pool_yes_before > 0),
  pool_no_before numeric(28, 8) not null check (pool_no_before > 0),
  pool_yes_after numeric(28, 8) not null check (pool_yes_after > 0),
  pool_no_after numeric(28, 8) not null check (pool_no_after > 0),
  created_at timestamptz not null default now()
);

create table public.positions (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  market_id bigint not null references public.markets(id) on delete restrict,
  yes_shares numeric(28, 8) not null default 0 check (yes_shares >= 0),
  no_shares numeric(28, 8) not null default 0 check (no_shares >= 0),
  total_invested numeric(20, 4) not null default 0 check (total_invested >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

create table public.market_settlements (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  winning_outcome text not null check (winning_outcome in ('yes', 'no')),
  winning_shares numeric(28, 8) not null check (winning_shares >= 0),
  payout numeric(20, 4) not null check (payout >= 0),
  wallet_transaction_id bigint unique references public.wallet_transactions(id) on delete restrict,
  settled_at timestamptz not null default now(),
  unique (market_id, user_id)
);

create table public.watchlists (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  market_id bigint not null references public.markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, market_id)
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Foreign keys are not indexed automatically in Postgres.
create index markets_category_id_idx on public.markets (category_id);
create index markets_created_by_idx on public.markets (created_by);
create index markets_resolved_by_idx on public.markets (resolved_by) where resolved_by is not null;
create index markets_feed_idx on public.markets (status, closes_at, created_at desc);
create index wallet_transactions_user_created_idx on public.wallet_transactions (user_id, created_at desc);
create index wallet_transactions_market_id_idx on public.wallet_transactions (market_id) where market_id is not null;
create unique index wallet_transactions_initial_grant_idx on public.wallet_transactions (user_id)
  where transaction_type = 'initial_grant';
create index trades_market_created_idx on public.trades (market_id, created_at);
create index trades_user_created_idx on public.trades (user_id, created_at desc);
create index positions_market_id_idx on public.positions (market_id);
create index market_settlements_user_id_idx on public.market_settlements (user_id);
create index watchlists_market_id_idx on public.watchlists (market_id);
create index admin_audit_actor_idx on public.admin_audit_log (actor_user_id) where actor_user_id is not null;
create index admin_audit_created_idx on public.admin_audit_log (created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger markets_set_updated_at
before update on public.markets
for each row execute function private.set_updated_at();

create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function private.set_updated_at();

create trigger positions_set_updated_at
before update on public.positions
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_balance constant numeric(20, 4) := 1000;
  requested_name text;
begin
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Student'
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, left(requested_name, 80))
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id, balance, lifetime_earned)
  values (new.id, initial_balance, initial_balance)
  on conflict (user_id) do nothing;

  insert into public.wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    note
  )
  values (
    new.id,
    'initial_grant',
    initial_balance,
    initial_balance,
    'initial-grant:' || new.id::text,
    'Initial EagleMarket play-token grant'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Backfill users who authenticated before this migration was applied.
insert into public.profiles (user_id, display_name, created_at)
select
  id,
  left(coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), split_part(email, '@', 1), 'Student'), 80),
  created_at
from auth.users
on conflict (user_id) do nothing;

insert into public.wallets (user_id, balance, lifetime_earned)
select user_id, 1000, 1000
from public.profiles
on conflict (user_id) do nothing;

insert into public.wallet_transactions (
  user_id,
  transaction_type,
  amount,
  balance_after,
  idempotency_key,
  note
)
select
  user_id,
  'initial_grant',
  1000,
  1000,
  'initial-grant:' || user_id::text,
  'Initial EagleMarket play-token grant'
from public.wallets
on conflict do nothing;

insert into public.categories (slug, name, color, icon_key, sort_order)
values
  ('classes', 'Classes', '#0b84bb', 'flask-conical', 10),
  ('campus', 'Campus', '#a264d8', 'calendar-days', 20),
  ('spw', 'SPW', '#d28a22', 'sparkles', 30),
  ('sports', 'Sports', '#2d9a70', 'trophy', 40),
  ('clubs', 'Clubs', '#e76d45', 'mic-2', 50),
  ('teachers', 'Teachers', '#667085', 'presentation', 60),
  ('seniors', 'Seniors', '#8f61c2', 'graduation-cap', 70)
on conflict (slug) do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.markets enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.market_settlements enable row level security;
alter table public.watchlists enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_authenticated_read
on public.profiles for select
to authenticated
using (account_status = 'active' or user_id = (select auth.uid()));

create policy profiles_self_update
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy categories_authenticated_read
on public.categories for select
to authenticated
using (is_active = true);

create policy markets_authenticated_read
on public.markets for select
to authenticated
using (status <> 'draft');

create policy wallets_self_read
on public.wallets for select
to authenticated
using (user_id = (select auth.uid()));

create policy wallet_transactions_self_read
on public.wallet_transactions for select
to authenticated
using (user_id = (select auth.uid()));

create policy trades_self_read
on public.trades for select
to authenticated
using (user_id = (select auth.uid()));

create policy positions_self_read
on public.positions for select
to authenticated
using (user_id = (select auth.uid()));

create policy market_settlements_self_read
on public.market_settlements for select
to authenticated
using (user_id = (select auth.uid()));

create policy watchlists_self_read
on public.watchlists for select
to authenticated
using (user_id = (select auth.uid()));

create policy watchlists_self_insert
on public.watchlists for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy watchlists_self_delete
on public.watchlists for delete
to authenticated
using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles, public.categories, public.markets to authenticated;
grant update (display_name, avatar_url, graduation_year) on public.profiles to authenticated;
grant select on public.wallets, public.wallet_transactions, public.trades, public.positions, public.market_settlements to authenticated;
grant select, insert, delete on public.watchlists to authenticated;
