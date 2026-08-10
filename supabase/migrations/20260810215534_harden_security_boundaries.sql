-- Reduce profile enumeration. Public ranking data is intentionally exposed only
-- through get_rankings(), which returns a narrow DTO instead of full profiles.
drop policy if exists profiles_authenticated_read on public.profiles;

create policy profiles_self_read
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

-- Audit records are visible only to active administrators. The subquery is
-- itself constrained by profiles_self_read, so users can inspect only their own
-- role while Postgres evaluates this policy.
create policy admin_audit_log_admin_read
on public.admin_audit_log for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.user_id = (select auth.uid())
      and profiles.role = 'admin'
      and profiles.account_status = 'active'
  )
);

grant select on public.admin_audit_log to authenticated;

-- Bound user/admin supplied text and require remotely loaded profile/source URLs
-- to use HTTPS. This prevents oversized rows and unsafe URL schemes from
-- becoming an XSS or resource-exhaustion problem in future UI surfaces.
alter table public.profiles
  add constraint profiles_avatar_url_safe check (
    avatar_url is null
    or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')
  ) not valid;

alter table public.markets
  add constraint markets_description_length check (
    description is null or char_length(description) <= 4000
  ) not valid,
  add constraint markets_resolution_source_url_safe check (
    resolution_source_url is null
    or (char_length(resolution_source_url) <= 2048 and resolution_source_url ~ '^https://')
  ) not valid;

alter table public.profiles validate constraint profiles_avatar_url_safe;
alter table public.markets validate constraint markets_description_length;
alter table public.markets validate constraint markets_resolution_source_url_safe;

-- Serialize each user's trades with an advisory transaction lock, then lock
-- market before wallet. Market resolution uses the same market -> wallet order,
-- preventing the previous trade/resolution lock inversion and deadlock window.
create or replace function public.submit_trade(
  p_market_id bigint,
  p_token_amount numeric,
  p_outcome text,
  p_idempotency_key uuid
)
returns table (
  trade_id bigint,
  balance numeric,
  market_id bigint,
  probability_yes numeric,
  probability_no numeric,
  shares_received numeric,
  total_volume numeric,
  pool_yes numeric,
  pool_no numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_market public.markets%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing_trade public.trades%rowtype;
  v_existing_transaction public.wallet_transactions%rowtype;
  v_wallet_transaction_id bigint;
  v_trade_id bigint;
  v_k numeric;
  v_new_pool_yes numeric;
  v_new_pool_no numeric;
  v_shares numeric;
  v_probability_before numeric;
  v_probability_yes numeric;
  v_average_price numeric;
  v_price_impact numeric;
  v_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;

  if p_outcome not in ('yes', 'no') then
    raise exception 'Outcome must be yes or no' using errcode = '22023';
  end if;

  if p_token_amount is null or p_token_amount <= 0 or p_token_amount > 10000 then
    raise exception 'Trade amount must be between 0 and 10000 EAG' using errcode = '22023';
  end if;

  if scale(p_token_amount) > 4 then
    raise exception 'Trade amount may have at most four decimal places' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.user_id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select wt.*
  into v_existing_transaction
  from public.wallet_transactions as wt
  where wt.user_id = v_user_id
    and wt.idempotency_key = p_idempotency_key::text;

  if found then
    select t.*
    into v_existing_trade
    from public.trades as t
    where t.wallet_transaction_id = v_existing_transaction.id;

    if not found then
      raise exception 'Idempotency key is already in use' using errcode = '23505';
    end if;

    select *
    into v_market
    from public.markets as m
    where m.id = v_existing_trade.market_id;

    return query
    select
      v_existing_trade.id,
      v_existing_transaction.balance_after,
      v_existing_trade.market_id,
      v_market.pool_no / (v_market.pool_yes + v_market.pool_no),
      v_market.pool_yes / (v_market.pool_yes + v_market.pool_no),
      v_existing_trade.shares_received,
      v_market.total_volume,
      v_market.pool_yes,
      v_market.pool_no;
    return;
  end if;

  if (
    select count(*)
    from public.trades as t
    where t.user_id = v_user_id
      and t.created_at >= clock_timestamp() - interval '1 second'
  ) >= 5 then
    raise exception 'Too many trades. Please wait a moment.' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.trades as t
    where t.user_id = v_user_id
      and t.created_at >= clock_timestamp() - interval '1 minute'
  ) >= 30 then
    raise exception 'Too many trades. Please wait a moment.' using errcode = 'P0001';
  end if;

  select *
  into v_market
  from public.markets as m
  where m.id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.status <> 'open' or now() < v_market.opens_at or now() >= v_market.closes_at then
    raise exception 'Market is not open for trading' using errcode = '22023';
  end if;

  select *
  into v_wallet
  from public.wallets as w
  where w.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  if v_wallet.balance < p_token_amount then
    raise exception 'Insufficient EAG balance' using errcode = '22003';
  end if;

  v_k := v_market.pool_yes * v_market.pool_no;

  if p_outcome = 'yes' then
    v_probability_before := v_market.pool_no / (v_market.pool_yes + v_market.pool_no);
    v_new_pool_no := v_market.pool_no + p_token_amount;
    v_new_pool_yes := v_k / v_new_pool_no;
    v_shares := p_token_amount + (v_market.pool_yes - v_new_pool_yes);
  else
    v_probability_before := v_market.pool_yes / (v_market.pool_yes + v_market.pool_no);
    v_new_pool_yes := v_market.pool_yes + p_token_amount;
    v_new_pool_no := v_k / v_new_pool_yes;
    v_shares := p_token_amount + (v_market.pool_no - v_new_pool_no);
  end if;

  v_probability_yes := v_new_pool_no / (v_new_pool_yes + v_new_pool_no);
  v_average_price := p_token_amount / v_shares;
  v_price_impact := greatest(0, (v_average_price - v_probability_before) / v_probability_before);
  v_balance := v_wallet.balance - p_token_amount;

  update public.wallets as w
  set
    balance = v_balance,
    lifetime_spent = w.lifetime_spent + p_token_amount
  where w.user_id = v_user_id;

  update public.markets as m
  set
    pool_yes = v_new_pool_yes,
    pool_no = v_new_pool_no,
    total_volume = m.total_volume + p_token_amount
  where m.id = p_market_id;

  insert into public.wallet_transactions (
    user_id,
    market_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    note
  )
  values (
    v_user_id,
    p_market_id,
    'trade',
    -p_token_amount,
    v_balance,
    p_idempotency_key::text,
    'Purchased ' || upper(p_outcome) || ' shares'
  )
  returning id into v_wallet_transaction_id;

  insert into public.trades (
    market_id,
    user_id,
    wallet_transaction_id,
    outcome,
    token_amount,
    shares_received,
    average_price,
    probability_before,
    probability_after,
    price_impact,
    pool_yes_before,
    pool_no_before,
    pool_yes_after,
    pool_no_after
  )
  values (
    p_market_id,
    v_user_id,
    v_wallet_transaction_id,
    p_outcome,
    p_token_amount,
    v_shares,
    v_average_price,
    v_probability_before,
    case when p_outcome = 'yes' then v_probability_yes else 1 - v_probability_yes end,
    v_price_impact,
    v_market.pool_yes,
    v_market.pool_no,
    v_new_pool_yes,
    v_new_pool_no
  )
  returning id into v_trade_id;

  insert into public.positions (user_id, market_id, yes_shares, no_shares, total_invested)
  values (
    v_user_id,
    p_market_id,
    case when p_outcome = 'yes' then v_shares else 0 end,
    case when p_outcome = 'no' then v_shares else 0 end,
    p_token_amount
  )
  on conflict on constraint positions_pkey do update
  set
    yes_shares = public.positions.yes_shares + excluded.yes_shares,
    no_shares = public.positions.no_shares + excluded.no_shares,
    total_invested = public.positions.total_invested + excluded.total_invested;

  return query
  select
    v_trade_id,
    v_balance,
    p_market_id,
    v_probability_yes,
    1 - v_probability_yes,
    v_shares,
    v_market.total_volume + p_token_amount,
    v_new_pool_yes,
    v_new_pool_no;
end;
$$;

revoke all on function public.submit_trade(bigint, numeric, text, uuid) from public, anon;
grant execute on function public.submit_trade(bigint, numeric, text, uuid) to authenticated;
