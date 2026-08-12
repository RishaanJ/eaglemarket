-- Referral program: fraud defences and the minting boundary.
--
--   supabase test db

begin;

create extension if not exists pgtap;

select plan(33);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Emails are chosen to exercise the normalisation rules: the alice variants all
-- collapse to the same inbox.

insert into auth.users (id, email, email_confirmed_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'referrer@fusdk12.net', now()),
  ('00000000-0000-4000-8000-0000000000a2', 'alice@fusdk12.net', now()),
  ('00000000-0000-4000-8000-0000000000a3', 'al.ice+spring@fusdk12.net', now()),
  ('00000000-0000-4000-8000-0000000000a4', 'unconfirmed@fusdk12.net', null),
  ('00000000-0000-4000-8000-0000000000a6', 'admin@fusdk12.net', now());

update public.profiles set role = 'admin'
where user_id = '00000000-0000-4000-8000-0000000000a6';

insert into public.markets (
  category_id, question, resolution_criteria, status, opens_at, closes_at, created_by
)
select
  categories.id,
  'Will the referral fraud defences hold under test?',
  'Resolves yes when every assertion in this suite passes.',
  'open', now() - interval '1 hour', now() + interval '30 days',
  '00000000-0000-4000-8000-0000000000a6'
from public.categories where categories.slug = 'classes';

-- ── Email normalisation ─────────────────────────────────────────────────────

select is(
  private.normalize_email('al.ice+spring@school.test'),
  'alice@school.test',
  'dots and +tag are stripped from the local part'
);

select is(
  private.normalize_email('Alice@School.TEST'),
  'alice@school.test',
  'normalisation is case-insensitive'
);

select is(
  private.normalize_email('not-an-email'),
  null,
  'a value with no @ normalises to null'
);

-- ── The program is off until a domain is allowlisted ────────────────────────

select is(
  (select count(*)::int from public.referral_allowed_domains),
  0,
  'the domain allowlist ships empty, so the program is inert by default'
);

-- ── Code issue ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select matches(
  public.get_my_referral_code(),
  '^[A-Z0-9]{8}$',
  'a referral code is issued on first request'
);

select is(
  public.get_my_referral_code(),
  public.get_my_referral_code(),
  'the code is stable across calls'
);

-- ── The minting boundary ────────────────────────────────────────────────────
-- This is the whole point: a student session must not be able to reach the
-- credit path at all.

select throws_ok(
  $$ select private.credit_referral('00000000-0000-4000-8000-0000000000a2') $$,
  '42501', null,
  'a student cannot call private.credit_referral'
);

select throws_ok(
  $$ select private.generate_referral_code() $$,
  '42501', null,
  'a student cannot call the code generator'
);

select throws_ok(
  $$ select private.normalize_email('x@y.test') $$,
  '42501', null,
  'a student cannot call the normaliser'
);

select throws_ok(
  $$ update public.wallets set balance = balance + 250
     where user_id = '00000000-0000-4000-8000-0000000000a1' $$,
  '42501', null,
  'a student cannot credit their own wallet directly'
);

select throws_ok(
  $$ update public.wallets set referral_earned = 0
     where user_id = '00000000-0000-4000-8000-0000000000a1' $$,
  '42501', null,
  'a student cannot zero their referral_earned to escape the rank penalty'
);

select throws_ok(
  $$ insert into public.referrals (referrer_id, referred_id, code)
     values ('00000000-0000-4000-8000-0000000000a1',
             '00000000-0000-4000-8000-0000000000a2', 'ABCD2345') $$,
  '42501', null,
  'a student cannot insert a referral row directly'
);

select throws_ok(
  $$ update public.referrals set status = 'pending' $$,
  '42501', null,
  'a student cannot rewrite referral status'
);

select throws_ok(
  $$ insert into public.referral_allowed_domains (domain) values ('gmail.test') $$,
  '42501', null,
  'a student cannot allowlist their own email domain'
);

select throws_ok(
  $$ select public.admin_set_referral_domains(array['gmail.test']) $$,
  '42501', 'Administrator access required',
  'a student cannot manage the domain allowlist through the admin RPC'
);

-- ── Structural fraud constraints ────────────────────────────────────────────

reset role;

select throws_ok(
  $$ insert into public.referrals (referrer_id, referred_id, code)
     values ('00000000-0000-4000-8000-0000000000a1',
             '00000000-0000-4000-8000-0000000000a1', 'SELFREF1') $$,
  '23514', null,
  'self-referral is rejected by a CHECK constraint, not by application code'
);

insert into public.referrals (referrer_id, referred_id, code)
values ('00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000a2', 'FIRSTREF');

select throws_ok(
  $$ insert into public.referrals (referrer_id, referred_id, code)
     values ('00000000-0000-4000-8000-0000000000a6',
             '00000000-0000-4000-8000-0000000000a2', 'SECONDRF') $$,
  '23505', null,
  'an account can be referred only once, ever'
);

-- ── Payout gating ───────────────────────────────────────────────────────────

-- Gate: no allowlisted domain yet, so nothing pays.
select private.credit_referral('00000000-0000-4000-8000-0000000000a2');

select is(
  (select status from public.referrals
   where referred_id = '00000000-0000-4000-8000-0000000000a2'),
  'pending',
  'with an empty domain allowlist the bonus does not pay'
);

-- Switch the program on.
insert into public.referral_allowed_domains (domain) values ('fusdk12.net');

-- Gate: unconfirmed email must not pay.
insert into public.referrals (referrer_id, referred_id, code)
values ('00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000a4', 'UNCONFRM');

select private.credit_referral('00000000-0000-4000-8000-0000000000a4');

select is(
  (select status from public.referrals
   where referred_id = '00000000-0000-4000-8000-0000000000a4'),
  'pending',
  'an unconfirmed email does not pay'
);

-- The off-domain payout gate is no longer reachable from here: since the
-- school-domain trigger, an account outside @fusdk12.net cannot be created at
-- all, so there is no user to attach such a referral to. The allowlist gate
-- itself is still covered by the empty-allowlist case above.

-- ── A legitimate payout ─────────────────────────────────────────────────────

select private.credit_referral('00000000-0000-4000-8000-0000000000a2');

select is(
  (select status from public.referrals
   where referred_id = '00000000-0000-4000-8000-0000000000a2'),
  'paid',
  'a confirmed, allowlisted referral pays'
);

select is(
  (select balance from public.wallets
   where user_id = '00000000-0000-4000-8000-0000000000a1'),
  1250::numeric,
  'the referrer balance moves by exactly 250'
);

select is(
  (select balance from public.wallets
   where user_id = '00000000-0000-4000-8000-0000000000a2'),
  1250::numeric,
  'the referred balance moves by exactly 250'
);

-- lifetime_earned is the get_rankings tiebreaker. If a referral moved it, the
-- bonus would farm rank one layer below portfolio_value.
select is(
  (select count(*)::int from public.wallets
   where user_id in ('00000000-0000-4000-8000-0000000000a1',
                     '00000000-0000-4000-8000-0000000000a2')
     and lifetime_earned <> 1000),
  0,
  'lifetime_earned is untouched on both sides'
);

select is(
  (select count(*)::int from public.wallets
   where user_id in ('00000000-0000-4000-8000-0000000000a1',
                     '00000000-0000-4000-8000-0000000000a2')
     and referral_earned <> 250),
  0,
  'referral_earned records the bonus on both sides'
);

select is(
  (select count(*)::int from public.admin_audit_log where action = 'referral.paid'),
  1,
  'the payout writes exactly one audit row'
);

-- ── Rank is not purchasable ─────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select is(
  (select portfolio_value from public.get_rankings(100) where is_current_user),
  1000::numeric,
  'portfolio_value excludes referral EAG, so the bonus buys no rank'
);

reset role;

-- ── Replay is a no-op ───────────────────────────────────────────────────────

select private.credit_referral('00000000-0000-4000-8000-0000000000a2');

select is(
  (select balance from public.wallets
   where user_id = '00000000-0000-4000-8000-0000000000a1'),
  1250::numeric,
  'replaying the credit does not pay a second time'
);

select is(
  (select count(*)::int from public.wallet_transactions
   where transaction_type = 'referral_bonus'),
  2,
  'exactly two referral transactions exist after the replay'
);

-- ── Plus-address dedupe ─────────────────────────────────────────────────────
-- al.ice+spring@school.test is the same inbox as alice@school.test.

insert into public.referrals (referrer_id, referred_id, code)
values ('00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000a3', 'PLUSADDR');

select private.credit_referral('00000000-0000-4000-8000-0000000000a3');

select is(
  (select status from public.referrals
   where referred_id = '00000000-0000-4000-8000-0000000000a3'),
  'rejected',
  'a plus-addressed alias of an already-paid inbox is rejected'
);

select is(
  (select balance from public.wallets
   where user_id = '00000000-0000-4000-8000-0000000000a1'),
  1250::numeric,
  'the plus-address alias mints nothing'
);

-- ── The cap ─────────────────────────────────────────────────────────────────

do $$
declare
  v_id uuid;
begin
  for i in 1..6 loop
    v_id := ('00000000-0000-4000-8000-0000000000c' || i::text)::uuid;
    insert into auth.users (id, email, email_confirmed_at)
    values (v_id, 'capped' || i::text || '@fusdk12.net', now());
    insert into public.referrals (referrer_id, referred_id, code)
    values ('00000000-0000-4000-8000-0000000000a1', v_id, 'CAPTEST' || i::text);
    perform private.credit_referral(v_id);
  end loop;
end;
$$;

select is(
  (select count(*)::int from public.referrals
   where referrer_id = '00000000-0000-4000-8000-0000000000a1' and status = 'paid'),
  5,
  'the per-referrer cap stops paid referrals at five'
);

select is(
  (select referral_earned from public.wallets
   where user_id = '00000000-0000-4000-8000-0000000000a1'),
  1250::numeric,
  'a capped referrer cannot mint beyond 5 x 250 EAG'
);

-- Three rejections: the plus-address alias, plus the two cap-test accounts that
-- arrived after the fifth paid slot was taken (the first payout consumed one).
select is(
  (select count(*)::int from public.referrals
   where referrer_id = '00000000-0000-4000-8000-0000000000a1'
     and status = 'rejected'),
  3,
  'referrals beyond the cap and the alias are recorded as rejected, not left pending'
);

select * from finish();

rollback;
