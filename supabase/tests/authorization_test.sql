-- Authorization boundary tests.
--
-- These assert that privileged operations fail at the DATABASE for a
-- non-admin, independently of whatever the UI chooses to render. Run with:
--
--   supabase test db
--
-- Everything executes inside a rolled-back transaction, so the tests leave no
-- residue and can be run repeatedly against a live local stack.

begin;

create extension if not exists pgtap;

select plan(19);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Inserting into auth.users fires private.handle_new_user(), which provisions
-- the profile and wallet, so these two users are indistinguishable from real
-- signups apart from the role we assign below.

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'student@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test');

update public.profiles
set role = 'admin'
where user_id = '00000000-0000-4000-8000-000000000002';

insert into public.markets (
  category_id, question, resolution_criteria,
  status, opens_at, closes_at, created_by
)
select
  categories.id,
  'Will the authorization boundary hold for non-admin callers?',
  'Resolves yes when every admin RPC rejects a student caller.',
  'open',
  now() - interval '1 hour',
  now() + interval '30 days',
  '00000000-0000-4000-8000-000000000002'
from public.categories
where categories.slug = 'classes';

-- ── Acting as an ordinary authenticated student ──────────────────────────────
-- This is exactly what a logged-in student's requests look like to Postgres:
-- the `authenticated` role, with their user id in the JWT claims that
-- auth.uid() reads.

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Every admin RPC must reject them at the database.

select throws_ok(
  $$ select public.admin_list_markets() $$,
  '42501', 'Administrator access required',
  'admin_list_markets rejects a student'
);

select throws_ok(
  $$ select public.admin_create_market(
       1, 'Will a student be able to create a market this way?',
       null, 'It must not be possible.', null,
       now(), now() + interval '7 days', 1000, 'open') $$,
  '42501', 'Administrator access required',
  'admin_create_market rejects a student'
);

select throws_ok(
  $$ select public.admin_set_market_status(1, 'closed') $$,
  '42501', 'Administrator access required',
  'admin_set_market_status rejects a student'
);

select throws_ok(
  $$ select public.admin_resolve_market(1, 'yes', null) $$,
  '42501', 'Administrator access required',
  'admin_resolve_market rejects a student'
);

-- The private schema itself is unreachable, so the gate cannot be bypassed by
-- calling the helper directly.

select throws_ok(
  $$ select private.require_admin() $$,
  '42501',
  null,
  'private.require_admin() is not callable by a student'
);

-- Privilege escalation: a student may update their own profile row, but the
-- column-level GRANT must stop them writing `role`. This is the single most
-- important check here — if it fails, every admin gate above is bypassable.

select throws_ok(
  $$ update public.profiles set role = 'admin'
     where user_id = '00000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'a student cannot promote themselves to admin'
);

select throws_ok(
  $$ update public.profiles set account_status = 'suspended'
     where user_id = '00000000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'a student cannot suspend another account'
);

-- Writing market state directly must fail: no table-level grants exist, so the
-- AMM cannot be bypassed by editing pools or resolving a market by hand.

select throws_ok(
  $$ update public.markets set status = 'resolved', resolved_outcome = 'yes' $$,
  '42501', null,
  'a student cannot resolve a market by direct UPDATE'
);

select throws_ok(
  $$ update public.markets set pool_yes = 1, pool_no = 1000000 $$,
  '42501', null,
  'a student cannot move the AMM pools directly'
);

select throws_ok(
  $$ update public.wallets set balance = 999999
     where user_id = '00000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'a student cannot mint themselves EAG'
);

select throws_ok(
  $$ insert into public.trades (
       market_id, user_id, wallet_transaction_id, outcome, token_amount,
       shares_received, average_price, probability_before, probability_after,
       price_impact, pool_yes_before, pool_no_before, pool_yes_after, pool_no_after)
     values (1, '00000000-0000-4000-8000-000000000001', 1, 'yes', 1,
       1, 0.5, 0.5, 0.5, 0, 1000, 1000, 1000, 1000) $$,
  '42501', null,
  'a student cannot forge a trade row'
);

select throws_ok(
  $$ insert into public.positions (user_id, market_id, yes_shares, no_shares, total_invested)
     values ('00000000-0000-4000-8000-000000000001', 1, 1000, 0, 0) $$,
  '42501', null,
  'a student cannot forge a position'
);

select throws_ok(
  $$ insert into public.admin_audit_log (action, target_type, target_id)
     values ('market.resolved', 'market', '1') $$,
  '42501', null,
  'a student cannot write to the admin audit log'
);

-- RLS read isolation: another student's wallet and positions are invisible,
-- and the audit log is invisible entirely.

select is(
  (select count(*) from public.wallets
   where user_id = '00000000-0000-4000-8000-000000000002')::int,
  0,
  'RLS hides another user''s wallet'
);

select is(
  (select count(*) from public.wallet_transactions
   where user_id = '00000000-0000-4000-8000-000000000002')::int,
  0,
  'RLS hides another user''s transactions'
);

select is(
  (select count(*) from public.admin_audit_log)::int,
  0,
  'RLS hides the admin audit log from students'
);

-- A student can still see their own wallet, so the policies are not simply
-- denying everything.

select is(
  (select count(*) from public.wallets
   where user_id = '00000000-0000-4000-8000-000000000001')::int,
  1,
  'a student can still read their own wallet'
);

-- ── Acting as the admin ─────────────────────────────────────────────────────
-- The same calls must now succeed, proving the gate discriminates on role
-- rather than failing closed for everyone.

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.admin_list_markets() $$,
  'admin_list_markets succeeds for an admin'
);

select isnt(
  (select public.admin_create_market(
     (select id from public.categories where slug = 'campus'),
     'Will an admin be able to create a market through the RPC?',
     null, 'Resolves yes when this row is created.', null,
     now(), now() + interval '7 days', 1000, 'draft')),
  null,
  'admin_create_market succeeds for an admin'
);

select * from finish();

rollback;
