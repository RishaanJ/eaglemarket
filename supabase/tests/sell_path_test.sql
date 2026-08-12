-- Sell / exit path invariants.
--
-- Covers the invariant table agreed before the migration was written: holdings
-- bounds, pool and probability bounds, price bounds, idempotency, market state,
-- the slippage floor, and that a buy/sell sequence leaves the pools consistent.
--
--   supabase test db

begin;

create extension if not exists pgtap;

select plan(25);

-- ── Fixtures ────────────────────────────────────────────────────────────────

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'seller@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'other@example.test');

update public.profiles set role = 'admin'
where user_id = '00000000-0000-4000-8000-00000000000b';

insert into public.markets (
  category_id, question, resolution_criteria,
  status, opens_at, closes_at, created_by
)
select
  categories.id,
  'Will the sell path preserve the constant product?',
  'Resolves yes when every assertion in this suite passes.',
  'open',
  now() - interval '1 hour',
  now() + interval '30 days',
  '00000000-0000-4000-8000-00000000000b'
from public.categories where categories.slug = 'classes';

-- A second market kept closed, to prove sells respect market state.
insert into public.markets (
  category_id, question, resolution_criteria,
  status, opens_at, closes_at, created_by
)
select
  categories.id,
  'Will a closed market reject an attempted exit?',
  'Resolves yes when the closed-market guard holds.',
  'closed',
  now() - interval '2 hours',
  now() + interval '30 days',
  '00000000-0000-4000-8000-00000000000b'
from public.categories where categories.slug = 'campus';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

-- ── Guards that apply before any position exists ────────────────────────────

select throws_ok(
  format($$ select public.submit_sell(%s, 10, 'yes', '11111111-1111-4111-8111-111111111101') $$,
         (select min(id) from public.markets)),
  '22023', 'You do not hold a position in this market',
  'selling with no position at all is rejected'
);

-- ── Buy first, so there is something to sell ────────────────────────────────

select lives_ok(
  format($$ select public.submit_trade(%s, 100, 'yes', '11111111-1111-4111-8111-111111111102') $$,
         (select min(id) from public.markets)),
  'buy 100 EAG of YES to open a position'
);

select is(
  (select round(yes_shares, 4) from public.positions
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  190.9091::numeric,
  'the buy returned the expected 190.9091 shares'
);

-- ── Holdings bounds ─────────────────────────────────────────────────────────

select throws_ok(
  format($$ select public.submit_sell(%s, 500, 'yes', '11111111-1111-4111-8111-111111111103') $$,
         (select min(id) from public.markets)),
  '22023', null,
  'selling more shares than held is rejected'
);

select throws_ok(
  format($$ select public.submit_sell(%s, 10, 'no', '11111111-1111-4111-8111-111111111104') $$,
         (select min(id) from public.markets)),
  '22023', null,
  'selling the side you do not hold is rejected'
);

select throws_ok(
  format($$ select public.submit_sell(%s, 0, 'yes', '11111111-1111-4111-8111-111111111105') $$,
         (select min(id) from public.markets)),
  '22023', 'Sell amount must be greater than zero',
  'selling zero shares is rejected'
);

select throws_ok(
  format($$ select public.submit_sell(%s, -5, 'yes', '11111111-1111-4111-8111-111111111106') $$,
         (select min(id) from public.markets)),
  '22023', 'Sell amount must be greater than zero',
  'selling a negative quantity is rejected'
);

select throws_ok(
  format($$ select public.submit_sell(%s, 1.1234567891, 'yes', '11111111-1111-4111-8111-111111111107') $$,
         (select min(id) from public.markets)),
  '22023', 'Sell amount may have at most eight decimal places',
  'more than eight decimal places is rejected'
);

select throws_ok(
  format($$ select public.submit_sell(%s, 10, 'yes', '11111111-1111-4111-8111-111111111108') $$,
         (select max(id) from public.markets)),
  '22023', null,
  'selling into a closed market is rejected'
);

-- ── The slippage floor ──────────────────────────────────────────────────────

select throws_ok(
  format($$ select public.submit_sell(%s, 10, 'yes', '11111111-1111-4111-8111-111111111109', 99999) $$,
         (select min(id) from public.markets)),
  'P0001', null,
  'a sale below p_min_proceeds is rejected'
);

-- ── The round trip ──────────────────────────────────────────────────────────
-- Selling the entire position straight back must return exactly the 100 EAG the
-- buy consumed and restore the pools, because no fee is charged.

-- Sell the exact holding, to eight decimals. Rounding the holding to four
-- places rounds it up as often as down, and rounding up exceeds what is held.
select is(
  (select round(proceeds, 6) from public.submit_sell(
     (select min(id) from public.markets),
     (select yes_shares from public.positions
      where user_id = '00000000-0000-4000-8000-00000000000a'),
     'yes', '11111111-1111-4111-8111-111111111110')),
  100.000000::numeric,
  'selling the whole position returns exactly the 100 EAG it cost'
);

select is(
  (select round(balance, 4) from public.wallets
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  1000.0000::numeric,
  'balance is back to the starting 1000 EAG'
);

select is(
  (select round(pool_yes, 4) || '/' || round(pool_no, 4) from public.markets
   where id = (select min(id) from public.markets)),
  '1000.0000/1000.0000',
  'pools are restored exactly, so k is preserved across the round trip'
);

select is(
  (select round(yes_shares, 4) from public.positions
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  0.0000::numeric,
  'the position is fully closed'
);

select is(
  (select round(total_invested, 4) from public.positions
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  0.0000::numeric,
  'cost basis is released in full when the whole position is sold'
);

-- lifetime_earned must not move: get_rankings uses it as a tiebreaker, and a
-- free round trip would otherwise farm it.
select is(
  (select lifetime_earned from public.wallets
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  1000::numeric,
  'lifetime_earned is untouched by a sale, so rank cannot be farmed'
);

-- ── Partial exit and proportional cost basis ────────────────────────────────

select lives_ok(
  format($$ select public.submit_trade(%s, 200, 'no', '11111111-1111-4111-8111-111111111111') $$,
         (select min(id) from public.markets)),
  'buy 200 EAG of NO'
);

select lives_ok(
  format($$ select public.submit_sell(%s, %s, 'no', '11111111-1111-4111-8111-111111111112') $$,
         (select min(id) from public.markets),
         (select round(no_shares / 2, 8) from public.positions
          where user_id = '00000000-0000-4000-8000-00000000000a')),
  'sell half the NO position'
);

select ok(
  (select abs(total_invested - 100) < 0.01 from public.positions
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  'selling half the position releases half the cost basis'
);

-- ── Idempotency ─────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.trades
   where user_id = '00000000-0000-4000-8000-00000000000a' and direction = 'sell'),
  2,
  'two sells recorded so far'
);

select lives_ok(
  format($$ select public.submit_sell(%s, 1, 'no', '11111111-1111-4111-8111-111111111112') $$,
         (select min(id) from public.markets)),
  'replaying a used idempotency key does not raise'
);

select is(
  (select count(*)::int from public.trades
   where user_id = '00000000-0000-4000-8000-00000000000a' and direction = 'sell'),
  2,
  'the replay created no additional trade'
);

-- ── Standing invariants over every trade this suite produced ────────────────

select is(
  (select count(*)::int from public.trades
   where average_price <= 0 or average_price > 1),
  0,
  'every trade has 0 < average_price <= 1'
);

select is(
  (select count(*)::int from public.markets
   where pool_yes <= 0 or pool_no <= 0),
  0,
  'no pool ever went to zero or negative'
);

select is(
  (select count(*)::int from public.markets
   where pool_no / (pool_yes + pool_no) <= 0
      or pool_no / (pool_yes + pool_no) >= 1),
  0,
  'implied probability stayed strictly inside (0,1)'
);

select * from finish();

rollback;
