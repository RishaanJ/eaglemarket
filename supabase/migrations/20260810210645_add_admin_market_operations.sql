create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.user_id = v_user_id
      and profiles.role = 'admin'
      and profiles.account_status = 'active'
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return v_user_id;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

create or replace function public.admin_list_markets()
returns table (
  id bigint,
  category_id bigint,
  category_name text,
  category_color text,
  question text,
  description text,
  resolution_criteria text,
  resolution_source_url text,
  status text,
  resolved_outcome text,
  opens_at timestamptz,
  closes_at timestamptz,
  total_volume numeric,
  pool_yes numeric,
  pool_no numeric,
  created_at timestamptz,
  trade_count bigint,
  position_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with authorized as (
    select private.require_admin() as user_id
  ),
  trade_totals as (
    select trades.market_id, count(*) as trade_count
    from public.trades
    group by trades.market_id
  ),
  position_totals as (
    select positions.market_id, count(*) as position_count
    from public.positions
    where positions.yes_shares > 0 or positions.no_shares > 0
    group by positions.market_id
  )
  select
    markets.id,
    markets.category_id,
    categories.name,
    categories.color,
    markets.question,
    markets.description,
    markets.resolution_criteria,
    markets.resolution_source_url,
    markets.status,
    markets.resolved_outcome,
    markets.opens_at,
    markets.closes_at,
    markets.total_volume,
    markets.pool_yes,
    markets.pool_no,
    markets.created_at,
    coalesce(trade_totals.trade_count, 0),
    coalesce(position_totals.position_count, 0)
  from public.markets
  join public.categories on categories.id = markets.category_id
  cross join authorized
  left join trade_totals on trade_totals.market_id = markets.id
  left join position_totals on position_totals.market_id = markets.id
  order by
    case markets.status
      when 'open' then 1
      when 'closed' then 2
      when 'draft' then 3
      when 'resolved' then 4
      else 5
    end,
    markets.closes_at,
    markets.id;
$$;

create or replace function public.admin_create_market(
  p_category_id bigint,
  p_question text,
  p_description text,
  p_resolution_criteria text,
  p_resolution_source_url text,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_initial_liquidity numeric default 1000,
  p_status text default 'draft'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
  v_market_id bigint;
begin
  if p_status not in ('draft', 'open') then
    raise exception 'A new market must be draft or open' using errcode = '22023';
  end if;

  if p_question is null or char_length(trim(p_question)) not between 10 and 240 then
    raise exception 'Question must be between 10 and 240 characters' using errcode = '22023';
  end if;

  if p_resolution_criteria is null or char_length(trim(p_resolution_criteria)) not between 10 and 2000 then
    raise exception 'Resolution criteria must be between 10 and 2000 characters' using errcode = '22023';
  end if;

  if p_opens_at is null or p_closes_at is null or p_opens_at >= p_closes_at then
    raise exception 'Close time must be after open time' using errcode = '22023';
  end if;

  if p_status = 'open' and p_closes_at <= now() then
    raise exception 'An open market must close in the future' using errcode = '22023';
  end if;

  if p_initial_liquidity is null or p_initial_liquidity < 100 or p_initial_liquidity > 100000 then
    raise exception 'Initial liquidity must be between 100 and 100000 EAG per side' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.categories
    where categories.id = p_category_id and categories.is_active = true
  ) then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;

  insert into public.markets (
    category_id,
    question,
    description,
    resolution_criteria,
    resolution_source_url,
    status,
    opens_at,
    closes_at,
    pool_yes,
    pool_no,
    created_by
  )
  values (
    p_category_id,
    trim(p_question),
    nullif(trim(p_description), ''),
    trim(p_resolution_criteria),
    nullif(trim(p_resolution_source_url), ''),
    p_status,
    p_opens_at,
    p_closes_at,
    p_initial_liquidity,
    p_initial_liquidity,
    v_admin_id
  )
  returning markets.id into v_market_id;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    v_admin_id,
    'market.created',
    'market',
    v_market_id::text,
    jsonb_build_object('status', p_status, 'question', trim(p_question))
  );

  return v_market_id;
end;
$$;

create or replace function public.admin_set_market_status(
  p_market_id bigint,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
  v_market public.markets%rowtype;
begin
  if p_status not in ('open', 'closed') then
    raise exception 'Status must be open or closed' using errcode = '22023';
  end if;

  select * into v_market
  from public.markets
  where markets.id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if p_status = 'open' then
    if v_market.status <> 'draft' then
      raise exception 'Only draft markets can be published' using errcode = '22023';
    end if;
    if v_market.closes_at <= now() then
      raise exception 'Market close time must be in the future' using errcode = '22023';
    end if;
  elsif v_market.status <> 'open' then
    raise exception 'Only open markets can be closed' using errcode = '22023';
  end if;

  update public.markets
  set status = p_status
  where markets.id = p_market_id;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    v_admin_id,
    'market.status_changed',
    'market',
    p_market_id::text,
    jsonb_build_object('from', v_market.status, 'to', p_status)
  );

  return p_status;
end;
$$;

create or replace function public.admin_resolve_market(
  p_market_id bigint,
  p_outcome text,
  p_resolution_note text default null
)
returns table (
  settled_positions bigint,
  total_payout numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
  v_market public.markets%rowtype;
begin
  if p_outcome not in ('yes', 'no') then
    raise exception 'Outcome must be yes or no' using errcode = '22023';
  end if;

  if p_resolution_note is not null and char_length(p_resolution_note) > 1000 then
    raise exception 'Resolution note may not exceed 1000 characters' using errcode = '22023';
  end if;

  select * into v_market
  from public.markets
  where markets.id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found' using errcode = 'P0002';
  end if;

  if v_market.status <> 'closed' then
    raise exception 'Market must be closed before it can be resolved' using errcode = '22023';
  end if;

  update public.markets
  set
    status = 'resolved',
    resolved_outcome = p_outcome,
    resolved_at = now(),
    resolved_by = v_admin_id
  where markets.id = p_market_id;

  with payouts as (
    select
      positions.user_id,
      case when p_outcome = 'yes' then positions.yes_shares else positions.no_shares end as payout
    from public.positions
    where positions.market_id = p_market_id
  ),
  updated_wallets as (
    update public.wallets
    set
      balance = wallets.balance + payouts.payout,
      lifetime_earned = wallets.lifetime_earned + payouts.payout
    from payouts
    where wallets.user_id = payouts.user_id
      and payouts.payout > 0
    returning wallets.user_id, wallets.balance, payouts.payout
  )
  insert into public.wallet_transactions (
    user_id,
    market_id,
    transaction_type,
    amount,
    balance_after,
    idempotency_key,
    note
  )
  select
    updated_wallets.user_id,
    p_market_id,
    'payout',
    updated_wallets.payout,
    updated_wallets.balance,
    'settlement:' || p_market_id::text || ':' || updated_wallets.user_id::text,
    'Market resolved ' || upper(p_outcome)
  from updated_wallets;

  insert into public.market_settlements (
    market_id,
    user_id,
    winning_outcome,
    winning_shares,
    payout,
    wallet_transaction_id
  )
  select
    p_market_id,
    positions.user_id,
    p_outcome,
    case when p_outcome = 'yes' then positions.yes_shares else positions.no_shares end,
    case when p_outcome = 'yes' then positions.yes_shares else positions.no_shares end,
    wallet_transactions.id
  from public.positions
  left join public.wallet_transactions
    on wallet_transactions.idempotency_key =
      'settlement:' || p_market_id::text || ':' || positions.user_id::text
  where positions.market_id = p_market_id;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    v_admin_id,
    'market.resolved',
    'market',
    p_market_id::text,
    jsonb_build_object(
      'outcome', p_outcome,
      'note', nullif(trim(p_resolution_note), '')
    )
  );

  return query
  select
    count(*)::bigint,
    coalesce(sum(market_settlements.payout), 0)::numeric
  from public.market_settlements
  where market_settlements.market_id = p_market_id;
end;
$$;

revoke all on function public.admin_list_markets() from public, anon;
revoke all on function public.admin_create_market(bigint, text, text, text, text, timestamptz, timestamptz, numeric, text) from public, anon;
revoke all on function public.admin_set_market_status(bigint, text) from public, anon;
revoke all on function public.admin_resolve_market(bigint, text, text) from public, anon;

grant execute on function public.admin_list_markets() to authenticated;
grant execute on function public.admin_create_market(bigint, text, text, text, text, timestamptz, timestamptz, numeric, text) to authenticated;
grant execute on function public.admin_set_market_status(bigint, text) to authenticated;
grant execute on function public.admin_resolve_market(bigint, text, text) to authenticated;
