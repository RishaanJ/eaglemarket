create table public.market_price_history (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets(id) on delete cascade,
  trade_id bigint not null unique references public.trades(id) on delete cascade,
  probability_yes numeric(9, 8) not null check (probability_yes >= 0 and probability_yes <= 1),
  total_volume numeric(20, 4) not null check (total_volume >= 0),
  created_at timestamptz not null default now()
);

create index market_price_history_market_created_idx
on public.market_price_history (market_id, created_at);

create or replace function private.capture_market_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.market_price_history (
    market_id,
    trade_id,
    probability_yes,
    total_volume,
    created_at
  )
  select
    new.market_id,
    new.id,
    new.pool_no_after / (new.pool_yes_after + new.pool_no_after),
    markets.total_volume,
    new.created_at
  from public.markets
  where markets.id = new.market_id;

  return new;
end;
$$;

revoke execute on function private.capture_market_price_history() from public, anon, authenticated;

create trigger trades_capture_market_price_history
after insert on public.trades
for each row execute function private.capture_market_price_history();

insert into public.market_price_history (
  market_id,
  trade_id,
  probability_yes,
  total_volume,
  created_at
)
select
  trades.market_id,
  trades.id,
  trades.pool_no_after / (trades.pool_yes_after + trades.pool_no_after),
  sum(trades.token_amount) over (
    partition by trades.market_id
    order by trades.created_at, trades.id
  ),
  trades.created_at
from public.trades
on conflict (trade_id) do nothing;

alter table public.market_price_history enable row level security;

create policy market_price_history_authenticated_read
on public.market_price_history for select
to authenticated
using (true);

revoke all on public.market_price_history from anon, authenticated;
revoke all on sequence public.market_price_history_id_seq from anon, authenticated;
grant select on public.market_price_history to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'market_price_history'
  ) then
    alter publication supabase_realtime add table public.market_price_history;
  end if;
end;
$$;
