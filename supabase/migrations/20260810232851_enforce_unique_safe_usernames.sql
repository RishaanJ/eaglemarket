-- Treat display_name as EagleMarket's public username. The database owns the
-- canonicalization and moderation rules so REST clients cannot bypass them.

create or replace function private.normalize_username(candidate text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(btrim(candidate), '[[:space:]]+', ' ', 'g');
$$;

create or replace function private.username_contains_blocked_term(candidate text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  compact_name text;
  blocked_term text;
  -- Keep this list intentionally limited to unambiguous, severe profanity and
  -- slurs. Broad fragments such as "ass" create too many innocent matches.
  blocked_terms constant text[] := array[
    'bitch', 'chink', 'cunt', 'faggot', 'fuck', 'kike', 'nigga', 'nigger',
    'retard', 'shit', 'slut', 'whore'
  ];
begin
  compact_name := regexp_replace(lower(candidate), '[^a-z0-9]', '', 'g');
  compact_name := translate(compact_name, '013457', 'oieast');

  foreach blocked_term in array blocked_terms loop
    if strpos(compact_name, blocked_term) > 0 then
      return true;
    end if;
  end loop;

  -- This shorter slur is checked as a complete username (with an optional
  -- numeric suffix) so innocent words such as "spice" are not rejected.
  if compact_name ~ '^spic[0-9]*$' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function private.username_is_permitted(candidate text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    char_length(private.normalize_username(candidate)) between 3 and 30
    and private.normalize_username(candidate)
      ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$'
    and not private.username_contains_blocked_term(candidate);
$$;

revoke execute on function private.normalize_username(text) from public, anon, authenticated;
revoke execute on function private.username_contains_blocked_term(text) from public, anon, authenticated;
revoke execute on function private.username_is_permitted(text) from public, anon, authenticated;

-- Repair legacy rows before adding the unique index. The first owner of a
-- case-insensitive duplicate keeps the name. Later duplicates retain as much
-- of their name as possible and receive a stable suffix. Invalid legacy names
-- receive a neutral, stable fallback instead of blocking the migration.
with normalized_profiles as (
  select
    user_id,
    private.normalize_username(display_name) as normalized_name,
    row_number() over (
      partition by lower(private.normalize_username(display_name))
      order by created_at, user_id
    ) as duplicate_number
  from public.profiles
), repaired_profiles as (
  select
    user_id,
    case
      when private.username_is_permitted(normalized_name)
        and duplicate_number = 1
        then normalized_name
      when private.username_is_permitted(normalized_name)
        then left(normalized_name, 21) || '_' || left(replace(user_id::text, '-', ''), 8)
      else 'Student_' || left(replace(user_id::text, '-', ''), 12)
    end as repaired_name
  from normalized_profiles
)
update public.profiles as profiles
set display_name = repaired_profiles.repaired_name
from repaired_profiles
where repaired_profiles.user_id = profiles.user_id
  and profiles.display_name is distinct from repaired_profiles.repaired_name;

create unique index profiles_display_name_case_insensitive_uidx
on public.profiles (lower(display_name));

create or replace function private.enforce_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.display_name := private.normalize_username(new.display_name);

  if char_length(new.display_name) not between 3 and 30
    or new.display_name !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$'
  then
    raise exception using
      errcode = '23514',
      message = 'USERNAME_INVALID_FORMAT';
  end if;

  if private.username_contains_blocked_term(new.display_name) then
    raise exception using
      errcode = '23514',
      message = 'USERNAME_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_profile_username() from public, anon, authenticated;

create trigger profiles_enforce_username
before insert or update of display_name on public.profiles
for each row execute function private.enforce_profile_username();

-- OAuth providers frequently return the same full name for different people.
-- Generate a stable suffix when that public username is already taken rather
-- than allowing the auth.users transaction to fail.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_balance constant numeric(20, 4) := 1000;
  requested_name text;
  chosen_name text;
begin
  requested_name := private.normalize_username(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Student'
  ));

  if not private.username_is_permitted(requested_name) then
    requested_name := 'Student';
  end if;

  -- Serialize signups requesting the same provider name. Without this lock,
  -- simultaneous OAuth callbacks could both pass the availability lookup and
  -- one could abort account creation at the unique index.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(lower(requested_name), 0)
  );

  chosen_name := requested_name;

  if exists (
    select 1
    from public.profiles
    where lower(display_name) = lower(chosen_name)
  ) then
    chosen_name := left(requested_name, 21)
      || '_'
      || left(replace(new.id::text, '-', ''), 8);
  end if;

  begin
    insert into public.profiles (user_id, display_name)
    values (new.id, chosen_name)
    on conflict (user_id) do nothing;
  exception
    when unique_violation then
      -- Defend against a pre-existing collision with the generated suffix.
      chosen_name := left(requested_name, 17)
        || '_'
        || left(replace(new.id::text, '-', ''), 12);

      insert into public.profiles (user_id, display_name)
      values (new.id, chosen_name)
      on conflict (user_id) do nothing;
  end;

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
