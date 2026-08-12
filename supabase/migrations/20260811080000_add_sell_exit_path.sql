-- Sell / exit path for the constant-product market maker.
--
-- Mirror of the buy in submit_trade: shares in, tokens out, same curve
-- reversed. Selling s shares of an outcome returns r tokens, where r is chosen
-- so the constant product is preserved:
--
--   (y + s - r)(n - r) = k = y * n          -- selling YES
--
-- Expanding gives a quadratic in r:
--
--   r^2 - r(y + s + n) + s*n = 0
--   r = [ (y + s + n) - sqrt((y + s + n)^2 - 4*s*n) ] / 2      -- smaller root
--
-- The smaller root is always the correct one, and it is always safe. Let
-- f(r) = (y + s - r)(n - r) - y*n. Then f(0) = s*n > 0 and f(n) = -y*n < 0, so
-- a root lies strictly in (0, n). That gives n - r > 0 for free, and since the
-- product (y + s - r)(n - r) equals y*n > 0, the other factor is positive too.
-- Both pools therefore stay strictly positive without needing a clamp, which
-- in turn keeps the implied probability strictly inside (0, 1).
--
-- Selling NO is the same with the roles of the two pools swapped.
--
-- No fee is charged, which is deliberate and matches the buy path as it
-- actually exists today. A zero-fee round trip returns exactly the tokens it
-- consumed, so nothing can be extracted by trading against yourself. When
-- fee-as-spread lands it must be applied to both directions in one change; a
-- fee on exit alone would make round trips quietly lossy while the buy UI
-- advertises no cost.

-- Sells need a row shape that the existing CHECK constraints allow:
-- shares_received > 0 and token_amount > 0 both still hold if we store
-- magnitudes and record the direction separately. Existing rows are buys.
alter table public.trades
  add column if not exists direction text not null default 'buy'
    check (direction in ('buy', 'sell'));

comment on column public.trades.direction is
  'buy = tokens in / shares out, sell = shares in / tokens out. token_amount and shares_received are magnitudes in both cases.';

-- Deliberately no index on `direction`: nothing filters by it yet, and trades
-- is on the hot write path of every trade. Add one when a query needs it.

create or replace function public.submit_sell(
  p_market_id bigint,
  p_shares numeric,
  p_outcome text,
  p_idempotency_key uuid,
  p_min_proceeds numeric default null
)
returns table (
  trade_id bigint,
  balance numeric,
  market_id bigint,
  probability_yes numeric,
  probability_no numeric,
  proceeds numeric,
  shares_sold numeric,
  average_price numeric,
  fee_amount numeric,
  remaining_yes_shares numeric,
  remaining_no_shares numeric,
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
  v_k numeric;
  v_sum numeric;
  v_discriminant numeric;
  v_proceeds numeric;
  v_new_pool_yes numeric;
  v_new_pool_no numeric;
  v_held numeric;
  v_probability_before numeric;
  v_probability_yes numeric;
  v_average_price numeric;
  v_balance numeric;
  v_invested_released numeric;
  v_remaining_yes numeric;
  v_remaining_no numeric;
  -- Guards for numeric(28,8) rounding at the extremes. Unreachable in normal
  -- play, but without them an extreme sell surfaces as a raw CHECK violation
  -- (HTTP 500) instead of a clean domain error.
  c_min_pool constant numeric := 0.00000001;
  c_min_price constant numeric := 0.00000001;
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

  if p_shares is null or p_shares <= 0 then
    raise exception 'Sell amount must be greater than zero' using errcode = '22023';
  end if;

  -- Eight decimals, not the four the buy path allows. That limit exists
  -- because a buy is denominated in EAG and wallets are numeric(20,4); a sell
  -- is denominated in shares, and positions are numeric(28,8). Rounding a
  -- holding to four places rounds it *up* as often as down, which would make
  -- closing a position outright impossible.
  if pg_catalog.scale(p_shares) > 8 then
    raise exception 'Sell amount may have at most eight decimal places' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.user_id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  -- Serialise everything this user does, so the idempotency check and the
  -- rate limit below are both safe under concurrent requests. Same lock the
  -- buy path takes, so a buy and a sell cannot interleave either.
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
      v_existing_trade.token_amount,
      v_existing_trade.shares_received,
      v_existing_trade.average_price,
      0::numeric,
      coalesce(v_position.yes_shares, 0),
      coalesce(v_position.no_shares, 0),
      v_market.total_volume,
      v_market.pool_yes,
      v_market.pool_no;
    return;
  end if;

  -- Shared budget with buys: both are rows in public.trades.
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

  select * into v_wallet
  from public.wallets as w
  where w.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found' using errcode = 'P0002';
  end if;

  select * into v_position
  from public.positions as p
  where p.user_id = v_user_id and p.market_id = p_market_id
  for update;

  if not found then
    raise exception 'You do not hold a position in this market' using errcode = '22023';
  end if;

  v_held := case when p_outcome = 'yes' then v_position.yes_shares else v_position.no_shares end;

  if v_held <= 0 then
    raise exception 'You do not hold any % shares in this market', upper(p_outcome)
      using errcode = '22023';
  end if;

  if p_shares > v_held then
    raise exception 'You only hold % % shares', v_held, upper(p_outcome)
      using errcode = '22023';
  end if;

  v_k := v_market.pool_yes * v_market.pool_no;
  v_sum := v_market.pool_yes + v_market.pool_no + p_shares;

  if p_outcome = 'yes' then
    v_probability_before := v_market.pool_no / (v_market.pool_yes + v_market.pool_no);
    v_discriminant := v_sum * v_sum - 4 * p_shares * v_market.pool_no;
  else
    v_probability_before := v_market.pool_yes / (v_market.pool_yes + v_market.pool_no);
    v_discriminant := v_sum * v_sum - 4 * p_shares * v_market.pool_yes;
  end if;

  -- Algebraically the discriminant cannot be negative here; this catches a
  -- rounding artefact rather than a real case.
  if v_discriminant < 0 then
    raise exception 'Sale could not be priced' using errcode = '22023';
  end if;

  v_proceeds := (v_sum - pg_catalog.sqrt(v_discriminant)) / 2;

  if p_outcome = 'yes' then
    v_new_pool_yes := v_market.pool_yes + p_shares - v_proceeds;
    v_new_pool_no := v_market.pool_no - v_proceeds;
  else
    v_new_pool_no := v_market.pool_no + p_shares - v_proceeds;
    v_new_pool_yes := v_market.pool_yes - v_proceeds;
  end if;

  if v_proceeds <= 0 or v_new_pool_yes < c_min_pool or v_new_pool_no < c_min_pool then
    raise exception 'Sale is too large for this market''s liquidity' using errcode = '22023';
  end if;

  v_average_price := v_proceeds / p_shares;

  if v_average_price < c_min_price or v_average_price > 1 then
    raise exception 'Sale could not be priced' using errcode = '22023';
  end if;

  if p_min_proceeds is not null and v_proceeds < p_min_proceeds then
    raise exception 'Price moved: this sale would return % EAG, below your % EAG minimum',
      round(v_proceeds, 4), round(p_min_proceeds, 4)
      using errcode = 'P0001';
  end if;

  v_probability_yes := v_new_pool_no / (v_new_pool_yes + v_new_pool_no);
  v_balance := v_wallet.balance + v_proceeds;

  -- Cost basis released by this sale, so total_invested keeps meaning "cost of
  -- what is still held" rather than "cost of everything ever bought".
  v_invested_released := least(
    v_position.total_invested,
    v_position.total_invested * (p_shares / v_held)
  );

  v_remaining_yes := v_position.yes_shares - case when p_outcome = 'yes' then p_shares else 0 end;
  v_remaining_no := v_position.no_shares - case when p_outcome = 'no' then p_shares else 0 end;

  -- lifetime_earned is deliberately NOT touched. get_rankings uses it as its
  -- tiebreaker, and since a zero-fee round trip is free, crediting sale
  -- proceeds there would let anyone farm rank by trading with themselves.
  -- lifetime_spent is reduced by the released basis, floored at zero because a
  -- profitable exit can return more than was ever spent.
  update public.wallets as w
  set
    balance = v_balance,
    lifetime_spent = greatest(0, w.lifetime_spent - v_invested_released)
  where w.user_id = v_user_id;

  update public.markets as m
  set
    pool_yes = v_new_pool_yes,
    pool_no = v_new_pool_no,
    total_volume = m.total_volume + v_proceeds
  where m.id = p_market_id;

  update public.positions as p
  set
    yes_shares = v_remaining_yes,
    no_shares = v_remaining_no,
    total_invested = greatest(0, p.total_invested - v_invested_released)
  where p.user_id = v_user_id and p.market_id = p_market_id;

  insert into public.wallet_transactions (
    user_id, market_id, transaction_type, amount, balance_after, idempotency_key, note
  )
  values (
    v_user_id,
    p_market_id,
    'trade',
    v_proceeds,
    v_balance,
    p_idempotency_key::text,
    'Sold ' || upper(p_outcome) || ' shares'
  )
  returning id into v_wallet_transaction_id;

  insert into public.trades (
    market_id, user_id, wallet_transaction_id, direction, outcome,
    token_amount, shares_received, average_price,
    probability_before, probability_after, price_impact,
    pool_yes_before, pool_no_before, pool_yes_after, pool_no_after
  )
  values (
    p_market_id,
    v_user_id,
    v_wallet_transaction_id,
    'sell',
    p_outcome,
    v_proceeds,
    p_shares,
    v_average_price,
    v_probability_before,
    case when p_outcome = 'yes' then v_probability_yes else 1 - v_probability_yes end,
    -- Selling moves the price against the seller, so impact is measured as the
    -- shortfall of the realised price against the pre-trade probability.
    greatest(0, (v_probability_before - v_average_price) / v_probability_before),
    v_market.pool_yes,
    v_market.pool_no,
    v_new_pool_yes,
    v_new_pool_no
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
    p_shares,
    v_average_price,
    0::numeric,
    v_remaining_yes,
    v_remaining_no,
    v_market.total_volume + v_proceeds,
    v_new_pool_yes,
    v_new_pool_no;
end;
$$;

revoke all on function public.submit_sell(bigint, numeric, text, uuid, numeric) from public, anon;
grant execute on function public.submit_sell(bigint, numeric, text, uuid, numeric) to authenticated;

comment on function public.submit_sell(bigint, numeric, text, uuid, numeric) is
  'Sells shares back into the constant-product pool. Mirror of submit_trade: shares in, tokens out, k preserved, no fee.';
