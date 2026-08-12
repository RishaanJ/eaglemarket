-- School email domain enforcement.
--
-- Asserts the gate holds at the DATABASE, independently of what the sign-up UI
-- validates, since the UI is bypassable by calling the auth endpoints directly.

begin;

create extension if not exists pgtap;

select plan(9);

-- A school address is accepted and provisioned as normal.
select lives_ok(
  $$ insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000e001', 'student@fusdk12.net', now(), '{}'::jsonb) $$,
  'a school address is accepted'
);

select is(
  (select count(*)::int from public.profiles where user_id = '00000000-0000-4000-8000-00000000e001'),
  1,
  'the accepted account is still provisioned with a profile'
);

-- Outside domains are refused.
select throws_ok(
  $$ insert into auth.users (id, email, email_confirmed_at)
     values ('00000000-0000-4000-8000-00000000e002', 'outsider@gmail.com', now()) $$,
  '42501',
  null,
  'a non-school address is rejected'
);

-- A rejected signup must leave nothing behind: the BEFORE trigger has to fire
-- ahead of the provisioning trigger, or a wallet would be created for an
-- account that does not exist.
select is(
  (select count(*)::int from public.profiles where user_id = '00000000-0000-4000-8000-00000000e002'),
  0,
  'a rejected signup provisions no profile'
);

select is(
  (select count(*)::int from public.wallets where user_id = '00000000-0000-4000-8000-00000000e002'),
  0,
  'a rejected signup provisions no wallet'
);

-- Near-miss domains that a suffix or first-@ check would wrongly accept.
select throws_ok(
  $$ insert into auth.users (id, email, email_confirmed_at)
     values ('00000000-0000-4000-8000-00000000e003', 'sneaky@notfusdk12.net', now()) $$,
  '42501',
  null,
  'a domain merely ending in the school domain is rejected'
);

select throws_ok(
  $$ insert into auth.users (id, email, email_confirmed_at)
     values ('00000000-0000-4000-8000-00000000e004', 'sneaky@fusdk12.net.evil.com', now()) $$,
  '42501',
  null,
  'a school domain used as a subdomain of another is rejected'
);

-- Case is not a way around it.
select lives_ok(
  $$ insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000e005', 'Mixed.Case@FUSDK12.NET', now(), '{}'::jsonb) $$,
  'an uppercase school address is accepted'
);

-- The side door: changing an address after the fact.
select throws_ok(
  $$ update auth.users set email = 'moved@gmail.com'
     where id = '00000000-0000-4000-8000-00000000e001' $$,
  '42501',
  null,
  'an existing account cannot move to an outside address'
);

select * from finish();

rollback;
