create or replace function public.execute_trade(
  p_market_id bigint,
  p_token_amount numeric,
  p_outcome text
)
returns table (
  trade_id bigint,
  balance numeric,
  market_id bigint,
  probability_yes numeric,
  probability_no numeric,
  shares_received numeric,
  total_volume numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_market public.markets%rowtype;
  v_wallet public.wallets%rowtype;
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

  if p_outcome not in ('yes', 'no') then
    raise exception 'Outcome must be yes or no' using errcode = '22023';
  end if;

  if p_token_amount is null or p_token_amount <= 0 or p_token_amount > 10000 then
    raise exception 'Trade amount must be between 0 and 10000 EAG' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = v_user_id and account_status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  select *
  into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.status <> 'open' or now() < v_market.opens_at or now() >= v_market.closes_at then
    raise exception 'Market is not open for trading' using errcode = '22023';
  end if;

  select *
  into v_wallet
  from public.wallets
  where user_id = v_user_id
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

  update public.wallets
  set
    balance = v_balance,
    lifetime_spent = lifetime_spent + p_token_amount
  where user_id = v_user_id;

  update public.markets
  set
    pool_yes = v_new_pool_yes,
    pool_no = v_new_pool_no,
    total_volume = public.markets.total_volume + p_token_amount
  where id = p_market_id;

  insert into public.wallet_transactions (
    user_id,
    market_id,
    transaction_type,
    amount,
    balance_after,
    note
  )
  values (
    v_user_id,
    p_market_id,
    'trade',
    -p_token_amount,
    v_balance,
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
    v_market.total_volume + p_token_amount;
end;
$$;

revoke all on function public.execute_trade(bigint, numeric, text) from public, anon;
grant execute on function public.execute_trade(bigint, numeric, text) to authenticated;

do $$
declare
  v_creator uuid;
  v_classes bigint;
  v_campus bigint;
  v_clubs bigint;
  v_sports bigint;
begin
  select user_id into v_creator
  from public.profiles
  where account_status = 'active'
  order by created_at
  limit 1;

  if v_creator is null or exists (select 1 from public.markets) then
    return;
  end if;

  select id into v_classes from public.categories where slug = 'classes';
  select id into v_campus from public.categories where slug = 'campus';
  select id into v_clubs from public.categories where slug = 'clubs';
  select id into v_sports from public.categories where slug = 'sports';

  insert into public.markets (
    category_id,
    question,
    description,
    resolution_criteria,
    status,
    opens_at,
    closes_at,
    created_by
  )
  values
    (
      v_classes,
      'Will the next Chem Honors Liu test average be above 82%?',
      'The market tracks the official class average after grading.',
      'Resolves Yes if the official class average posted by Ms. Liu is 82.1% or higher. Retakes are not included.',
      'open',
      now(),
      '2026-09-30 23:59:59-07'::timestamptz,
      v_creator
    ),
    (
      v_campus,
      'Will CO29 place above third at SPW?',
      'A market for the published final SPW standings.',
      'Resolves Yes if CO29 finishes first, second, or third in the official SPW results.',
      'open',
      now(),
      '2026-10-31 23:59:59-07'::timestamptz,
      v_creator
    ),
    (
      v_clubs,
      'Will Buggin Art Mag release its next issue this month?',
      'Tracks the next official Buggin Art Mag release.',
      'Resolves Yes if Buggin Art Mag publicly releases a new issue before this market closes.',
      'open',
      now(),
      '2026-08-31 23:59:59-07'::timestamptz,
      v_creator
    ),
    (
      v_sports,
      'Will varsity volleyball win its next home match?',
      'Tracks the official result of the next scheduled varsity volleyball home match.',
      'Resolves Yes if American High School wins its next varsity volleyball home match.',
      'open',
      now(),
      '2026-09-15 23:59:59-07'::timestamptz,
      v_creator
    );
end;
$$;
