-- The leaderboard does not need to expose stable auth UUIDs or avatar-provider
-- URLs to every browser. Return only display fields plus a caller-relative flag.
drop function if exists public.get_rankings(integer);

create function public.get_rankings(result_limit integer default 50)
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
      wallets.balance + coalesce(position_totals.open_value, 0) as portfolio_value,
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
  'Returns a data-minimized leaderboard to active authenticated EagleMarket users.';

revoke all on function public.get_rankings(integer) from public, anon;
grant execute on function public.get_rankings(integer) to authenticated;
