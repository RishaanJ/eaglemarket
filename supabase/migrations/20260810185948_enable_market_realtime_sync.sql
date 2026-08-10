do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'markets'
  ) then
    alter publication supabase_realtime add table public.markets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets'
  ) then
    alter publication supabase_realtime add table public.wallets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
end;
$$;
