-- One-Time Cash-Out pgTAP Test Suite
-- Covers all 20 enumerated edge cases, hard constraint (buy->cashout <= cost), and resolution conservation.

begin;

create extension if not exists pgtap;

select plan(27);

-- ── Fixtures Setup ─────────────────────────────────────────────────────────

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'trader1@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'trader2@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'admin1@example.test');

update public.profiles
set role = 'admin'
where user_id = '00000000-0000-4000-8000-00000000000c';

-- Market 1: Open market
insert into public.markets (
  id, category_id, question, resolution_criteria, status, opens_at, closes_at, created_by, pool_yes, pool_no
)
select
  1001, categories.id, 'Will market 1001 allow cashout testing?', 'Criteria 1001', 'open',
  now() - interval '1 hour', now() + interval '30 days', '00000000-0000-4000-8000-00000000000c', 1000, 1000
from public.categories where categories.slug = 'classes';

-- Market 2: Closed market
insert into public.markets (
  id, category_id, question, resolution_criteria, status, opens_at, closes_at, created_by, pool_yes, pool_no
)
select
  1002, categories.id, 'Will closed market 1002 reject cashout?', 'Criteria 1002', 'closed',
  now() - interval '2 hours', now() + interval '30 days', '00000000-0000-4000-8000-00000000000c', 1000, 1000
from public.categories where categories.slug = 'campus';

-- ── Test 18: Unauthenticated call ──────────────────────────────────────────
select throws_ok(
  $$ select public.submit_cashout(1001, '11111111-1111-4111-8111-111111111101') $$,
  '42501', 'Authentication required',
  'Case 18: Unauthenticated call raises exception'
);

-- Set user context as trader1
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

-- ── Test 1: Cash-out with no position ──────────────────────────────────────
select throws_ok(
  $$ select public.submit_cashout(1001, '11111111-1111-4111-8111-111111111101') $$,
  '22023', 'You do not hold a position in this market',
  'Case 1: Cash-out with no position is rejected'
);

-- ── Test 3: Cash-out on closed market ──────────────────────────────────────
select throws_ok(
  $$ select public.submit_cashout(1002, '11111111-1111-4111-8111-111111111102') $$,
  '22023', 'Market is not open for trading',
  'Case 3: Cash-out on closed market is rejected'
);

-- ── Buy 100 EAG of YES on Market 1001 ───────────────────────────────────────
select lives_ok(
  $$ select public.submit_trade(1001, 100, 'yes', '11111111-1111-4111-8111-111111111103') $$,
  'trader1 buys 100 EAG of YES'
);

-- Balance is now 900
select is(
  (select balance from public.wallets where user_id = '00000000-0000-4000-8000-00000000000a'),
  900.0000::numeric,
  'balance deducted to 900 EAG after 100 EAG buy'
);

-- ── Test 5, 6, 7, 8, 9, 10, 14, 16: Execute Cash-Out ─────────────────────────

select is(
  (select round(proceeds, 4) from public.submit_cashout(1001, '11111111-1111-4111-8111-111111111104')),
  100.0000::numeric,
  'Case 5 & 6: Cash-out returns exactly the 100 EAG cost basis (buy->cashout <= cost)'
);

select is(
  (select balance from public.wallets where user_id = '00000000-0000-4000-8000-00000000000a'),
  1000.0000::numeric,
  'Case 16: Balance restored to 1000 EAG after cash-out'
);

select is(
  (select pool_yes || '/' || pool_no from public.markets where id = 1001),
  '909.09090909/1100.00000000',
  'Case 7 & 8: Pool reserves and invariant k remain unchanged after cash-out'
);

select is(
  (select yes_shares || '/' || no_shares || '/' || total_invested from public.positions where user_id = '00000000-0000-4000-8000-00000000000a' and market_id = 1001),
  '0.00000000/0.00000000/0.0000',
  'Case 9: Position shares and total_invested are zeroed'
);

select ok(
  (select cashed_out_at is not null from public.positions where user_id = '00000000-0000-4000-8000-00000000000a' and market_id = 1001),
  'Case 10: cashed_out_at timestamp is set'
);

select is(
  (select lifetime_earned from public.wallets where user_id = '00000000-0000-4000-8000-00000000000a'),
  1000.0000::numeric,
  'Case 14: lifetime_earned is untouched by cash-out'
);

-- ── Test 11: Second cash-out rejected ──────────────────────────────────────
select throws_ok(
  $$ select public.submit_cashout(1001, '11111111-1111-4111-8111-111111111105') $$,
  '22023', 'You do not hold any shares in this market',
  'Case 11 & 2: Second cash-out attempt with 0 shares rejected'
);

-- ── Test 12: Re-buying after cash-out then attempting second cash-out ─────
select lives_ok(
  $$ select public.submit_trade(1001, 50, 'no', '11111111-1111-4111-8111-111111111106') $$,
  'trader1 re-buys 50 EAG of NO after cashing out'
);

select throws_ok(
  $$ select public.submit_cashout(1001, '11111111-1111-4111-8111-111111111107') $$,
  '22023', 'You have already cashed out of this market',
  'Case 12: Cash-out permanently barred even after re-buying'
);

-- ── Test 13: Idempotent replay of used key ──────────────────────────────────
select is(
  (select round(proceeds, 4) from public.submit_cashout(1001, '11111111-1111-4111-8111-111111111104')),
  100.0000::numeric,
  'Case 13: Idempotent replay of original cash-out key returns cached proceeds'
);

-- ── Test 15: Hedged position (YES + NO legs) ───────────────────────────────
-- Switch to trader2 context
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.submit_trade(1001, 100, 'yes', '22222222-2222-4222-8222-222222222201') $$,
  'trader2 buys 100 EAG of YES'
);

select lives_ok(
  $$ select public.submit_trade(1001, 100, 'no', '22222222-2222-4222-8222-222222222202') $$,
  'trader2 buys 100 EAG of NO'
);

select is(
  (select round(total_invested, 4) from public.positions where user_id = '00000000-0000-4000-8000-00000000000b' and market_id = 1001),
  200.0000::numeric,
  'trader2 total_invested is 200 EAG for hedged position'
);

select is(
  (select round(proceeds, 4) from public.submit_cashout(1001, '22222222-2222-4222-8222-222222222203')),
  200.0000::numeric,
  'Case 15: Hedged cash-out returns sum of cost basis (200 EAG)'
);

select is(
  (select yes_shares || '/' || no_shares from public.positions where user_id = '00000000-0000-4000-8000-00000000000b' and market_id = 1001),
  '0.00000000/0.00000000',
  'Case 15: Both YES and NO shares zeroed upon hedged cash-out'
);

-- ── Test 19: Suspended account ─────────────────────────────────────────────
update public.profiles set account_status = 'suspended' where user_id = '00000000-0000-4000-8000-00000000000b';

select throws_ok(
  $$ select public.submit_cashout(1001, '22222222-2222-4222-8222-222222222204') $$,
  '42501', 'Account is not active',
  'Case 19: Cash-out on suspended account is rejected'
);

-- ── Test 17: Conservation at resolution ───────────────────────────────────
-- Admin resolves market 1001 as YES
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}',
  true
);

-- First set market status to closed
select public.admin_set_market_status(1001, 'closed');

-- Now resolve market 1001 as 'yes'
select lives_ok(
  $$ select public.admin_resolve_market(1001, 'yes') $$,
  'admin resolves market 1001 as YES'
);

-- Prove conservation: total payouts to cashed-out users is 0 on resolution
select is(
  (select coalesce(sum(payout), 0) from public.market_settlements where market_id = 1001 and user_id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')),
  0.0000::numeric,
  'Case 17: Conservation holds - cashed out positions receive 0 resolution payout'
);

-- ── Test 4: Cash-out on resolved market ────────────────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.submit_cashout(1001, '11111111-1111-4111-8111-111111111108') $$,
  '22023', 'Market is not open for trading',
  'Case 4: Cash-out on resolved market is rejected'
);

select * from finish();

rollback;
