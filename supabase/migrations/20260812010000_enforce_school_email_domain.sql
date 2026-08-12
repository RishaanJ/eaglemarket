-- Restrict accounts to the school's email domain.
--
-- The UI asks for a school address and Google is hinted to offer only school
-- accounts, but both are cosmetic: a client can call the auth endpoints
-- directly, and the `hd` OAuth parameter is a request to Google, not a
-- guarantee to us. This trigger is the part that actually holds, because it
-- runs inside the same transaction that creates the auth user — a rejection
-- rolls the signup back entirely rather than leaving a half-provisioned row.
--
-- UPDATE is covered as well as INSERT: Supabase lets a signed-in user change
-- their own address, which would otherwise be a way in through the side door.
--
-- Existing accounts are deliberately untouched. This gates new addresses only;
-- locking out anyone who already signed up is a separate decision, and one
-- that could lock out the administrator making it.

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
  -- Nothing to check when an account carries no address (OAuth-only providers
  -- can behave this way); other gates cover that case.
  if new.email is null or pg_catalog.btrim(new.email) = '' then
    return new;
  end if;

  -- Everything after the LAST '@'. Comparing a suffix instead would accept
  -- 'someone@notfusdk12.net', and splitting on the first '@' would accept
  -- 'a@evil.com@fusdk12.net'.
  v_domain := pg_catalog.lower(pg_catalog.substring(new.email from '[^@]+$'));

  if v_domain is distinct from c_domain then
    raise exception 'Accounts are limited to % school email addresses', '@' || c_domain
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_school_email_domain() from public, anon, authenticated;

-- BEFORE, so a rejected address never reaches the provisioning trigger that
-- creates the profile, wallet, and opening grant.
drop trigger if exists enforce_school_email_domain on auth.users;
create trigger enforce_school_email_domain
before insert or update of email on auth.users
for each row execute function private.enforce_school_email_domain();

comment on function private.enforce_school_email_domain() is
  'Rejects any auth.users row whose email is outside the school domain. Applies to new addresses only; existing accounts are unaffected.';
