-- Fix: the domain check rejected existing accounts at sign-in.
--
-- The trigger fires on `update of email`, which Postgres raises whenever that
-- column appears in an UPDATE's SET list — even when the value is unchanged.
-- Supabase writes to auth.users on every sign-in, so a grandfathered address
-- was re-validated against the rule and refused, locking out every account
-- created before the rule existed.
--
-- The rule is about *creating* accounts on the school domain, not about using
-- accounts that already exist. An update that does not change the address is
-- therefore left alone; a genuine change is still checked.

create or replace function private.enforce_school_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_domain constant text := 'fusdk12.net';
  v_domain text;
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;

  if new.email is null or pg_catalog.btrim(new.email) = '' then
    return new;
  end if;

  v_domain := pg_catalog.lower(pg_catalog.substring(new.email, '[^@]+$'));

  if v_domain is distinct from c_domain then
    raise exception 'Accounts are limited to % school email addresses', '@' || c_domain
      using errcode = '42501';
  end if;

  return new;
end;
$$;
