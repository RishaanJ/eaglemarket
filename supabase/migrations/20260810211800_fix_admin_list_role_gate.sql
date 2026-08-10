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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();

  return query
  with trade_totals as (
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
end;
$$;

revoke all on function public.admin_list_markets() from public, anon;
grant execute on function public.admin_list_markets() to authenticated;
