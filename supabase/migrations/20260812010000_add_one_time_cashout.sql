-- One-time cash-out exit mechanic.
--
-- Replaces curve-based selling with a single, irreversible cost-basis refund.
-- The user's position (YES and NO shares) is zeroed and marked cashed out.
-- Pool reserves (pool_yes, pool_no) and invariant k remain untouched, preserving
-- pool depth for remaining market participants.
--
-- Cash-out proceeds equal the exact cost basis (positions.total_invested).
-- Hard constraint satisfied: buy -> cashout <= cost (trivially equal).
-- Conservation at resolution holds: returned EAG was deposited on buys and
-- absorbed by reserves; abandoned shares shrink winning payouts at settlement.

-- 1. Track one-time cash-out timestamp on positions.
alter table public.positions
  add column if not exists cashed_out_at timestamptz;

comment on column public.positions.cashed_out_at is
  'Timestamp when the position was permanently cashed out. Non-null prevents future cash-outs.';

-- 2. Extend trades direction to support buy, sell, and cashout.
alter table public.trades
  add column if not exists direction text not null default 'buy'
    check (direction in ('buy', 'sell', 'cashout'));

comment on column public.trades.direction is
  'Trade action type: buy, sell, or cashout.';

-- 3. Extend wallet_transactions transaction_type for cashout.
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_transaction_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_transaction_type_check
    check (transaction_type in ('initial_grant', 'trade', 'payout', 'refund', 'admin_adjustment', 'cashout'));

-- 4. Create submit_cashout SECURITY DEFINER RPC function.
create or replace function public.submit_cashout(
  p_market_id bigint,
  p_idempotency_key uuid
)
returns table (
  trade_id bigint,
  balance numeric,
  market_id bigint,
  probability_yes numeric,
  probability_no numeric,
  proceeds numeric,
  yes_shares_burned numeric,
  no_shares_burned numeric,
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
  v_position public.positions%rowtype;
  v_existing_trade public.trades%rowtype;
  v_existing_transaction public.wallet_transactions%rowtype;
  v_wallet_transaction_id bigint;
  v_trade_id bigint;
  v_proceeds numeric;
  v_yes_shares numeric;
  v_no_shares numeric;
  v_probability_yes numeric;
  v_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.user_id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  -- Transaction advisory lock per user serializes concurrent calls
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  -- Check for existing idempotency key replay
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

    select * into v_market
    from public.markets as m
    where m.id = v_existing_trade.market_id;

    select * into v_position
    from public.positions as p
    where p.user_id = v_user_id and p.market_id = v_existing_trade.market_id;

    return query
    select
      v_existing_trade.id,
      v_existing_transaction.balance_after,
      v_existing_trade.market_id,
      v_market.pool_no / (v_market.pool_yes + v_market.pool_no),
      v_market.pool_yes / (v_market.pool_yes + v_market.pool_no),
      v_existing_transaction.amount,
      0::numeric,
      0::numeric,
      v_market.total_volume,
      v_market.pool_yes,
      v_market.pool_no;
    return;
  end if;

  -- Shared rate limiting with trades (max 5/sec, 30/min)
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

  -- Lock market row to check open state
  select * into v_market
  from public.markets as m
  where m.id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.status <> 'open' or now() < v_market.opens_at or now() >= v_market.closes_at then
    raise exception 'Market is not open for trading' using errcode = '22023';
  end if;

  -- Lock wallet
  select * into v_wallet
  from public.wallets as w
  where w.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  -- Lock position
  select * into v_position
  from public.positions as p
  where p.user_id = v_user_id and p.market_id = p_market_id
  for update;

  if not found then
    raise exception 'You do not hold a position in this market' using errcode = '22023';
  end if;

  if v_position.cashed_out_at is not null then
    raise exception 'You have already cashed out of this market' using errcode = '22023';
  end if;

  if v_position.yes_shares <= 0 and v_position.no_shares <= 0 then
    raise exception 'You do not hold any shares in this market' using errcode = '22023';
  end if;

  v_yes_shares := v_position.yes_shares;
  v_no_shares := v_position.no_shares;
  v_proceeds := v_position.total_invested;

  v_probability_yes := v_market.pool_no / (v_market.pool_yes + v_market.pool_no);
  v_balance := v_wallet.balance + v_proceeds;

  -- Wallet update: refund cost basis, reduce lifetime_spent, DO NOT touch lifetime_earned
  update public.wallets as w
  set
    balance = v_balance,
    lifetime_spent = greatest(0, w.lifetime_spent - v_proceeds)
  where w.user_id = v_user_id;

  -- Zero position and record permanent cashout timestamp
  update public.positions as p
  set
    yes_shares = 0,
    no_shares = 0,
    total_invested = 0,
    cashed_out_at = now()
  where p.user_id = v_user_id and p.market_id = p_market_id;

  -- Record wallet transaction
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
    'cashout',
    v_proceeds,
    v_balance,
    p_idempotency_key::text,
    'One-time position cash-out'
  )
  returning id into v_wallet_transaction_id;

  -- Record trade log entry with direction = 'cashout'
  insert into public.trades (
    market_id,
    user_id,
    wallet_transaction_id,
    direction,
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
    'cashout',
    'yes', -- default outcome indicator for full-position cashout
    v_proceeds,
    greatest(v_yes_shares, v_no_shares),
    1.0,
    v_probability_yes,
    v_probability_yes,
    0,
    v_market.pool_yes,
    v_market.pool_no,
    v_market.pool_yes,
    v_market.pool_no
  )
  returning id into v_trade_id;

  return query
  select
    v_trade_id,
    v_balance,
    p_market_id,
    v_probability_yes,
    1 - v_probability_yes,
    v_proceeds,
    v_yes_shares,
    v_no_shares,
    v_market.total_volume,
    v_market.pool_yes,
    v_market.pool_no;
end;
$$;

revoke all on function public.submit_cashout(bigint, uuid) from public, anon;
grant execute on function public.submit_cashout(bigint, uuid) to authenticated;

comment on function public.submit_cashout(bigint, uuid) is
  'Executes a one-time cash-out for a user position at cost basis. Zeroes shares without touching pool reserves.';
