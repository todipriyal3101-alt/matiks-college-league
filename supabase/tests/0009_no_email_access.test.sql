-- =============================================================
-- Tests for 0009_no_email_access.sql (scripts/db-test.sh). Each t.run is rolled back.
-- =============================================================

grant usage on schema t to anon, authenticated;

create function t.signup(p_email text) returns text language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_id, p_email);
  return (select count(*)::text from public.college_access where user_id = v_id) || '|' ||
         coalesce((select string_agg(title, ',') from public.notifications where user_id = v_id), '-');
end $$;

-- ---------- Backfills ----------
select t.run('backfill', 'postgres', 'poc_email holders keep access through college_access (any case)',
  $q$ select count(*)::text from public.college_access where user_id = '00000000-0000-0000-0000-0000000000a3' and registration_id = '20000000-0000-0000-0000-000000000001' $q$, '1');
select t.run('backfill', 'postgres', 'emails without an account get a 14-day pending entry (active colleges only)',
  $q$ select string_agg(email || '@' || right(registration_id::text, 1) || ':' || (expires_at > now() + interval '13 days')::text, ',') from public.pending_access $q$,
  'lead@nitt.test@2:true');
select t.run('backfill', 'postgres', 'verified: old link confirmations, accepted invites and Google',
  $q$ select string_agg(right(user_id::text, 2) || ':' || method, ',' order by user_id) from public.verified_accounts $q$, 'a1:legacy,a2:google,a4:legacy');

-- ---------- poc_email no longer grants access ----------
insert into public.colleges (id, name, country) values ('11000000-0000-0000-0000-000000000009', 'IIT Delhi', 'india');
insert into public.registrations (id, league_id, college_id, poc_email, status) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000009', 'stranger@gmail.test', 'pending');
select t.run('access', 'stranger', 'matching a registration''s poc_email alone shows nothing',
  $q$ select count(*)::text from public.registrations $q$, '0');
select t.run('access', 'stranger', 'and is not a POC of it',
  $q$ select public.is_registration_poc('20000000-0000-0000-0000-000000000009')::text $q$, 'false');
select t.run('access', 'poc', 'college_access still works',
  $q$ select string_agg(right(id::text, 1), ',') from public.registrations $q$, '1');
select t.run('access', 'postgres', 'notifications go to college_access users only',
  $q$ select count(*)::text from public.registration_poc_users('20000000-0000-0000-0000-000000000009') $q$, '0');
delete from public.registrations where id = '20000000-0000-0000-0000-000000000009';

-- ---------- Pending access claimed on sign-up ----------
select t.run('claim', 'postgres', 'signing up with the exact email (any case) gets access + a notification',
  $q$ select t.signup('LEAD@nitt.test') $q$, '1|You can manage NIT Trichy / claimed',
  $c$ select case when claimed_at is not null then 'claimed' else 'open' end from public.pending_access where email = 'lead@nitt.test' $c$);
update public.pending_access set expires_at = now() - interval '1 minute' where email = 'lead@nitt.test';
select t.run('claim', 'postgres', 'an expired entry gives nothing',
  $q$ select t.signup('lead@nitt.test') $q$, '0|-');
update public.pending_access set expires_at = now() + interval '14 days', revoked_at = now() where email = 'lead@nitt.test';
select t.run('claim', 'postgres', 'a revoked entry gives nothing',
  $q$ select t.signup('lead@nitt.test') $q$, '0|-');
update public.pending_access set revoked_at = null where email = 'lead@nitt.test';
select t.run('claim', 'postgres', 'another email gives nothing',
  $q$ select t.signup('lead2@nitt.test') $q$, '0|-');

-- ---------- RLS ----------
select t.run('rls', 'admin', 'admins add pending entries',
  $q$ with x as (insert into public.pending_access (email, registration_id, invited_by) values ('ravi@iitb.test', '20000000-0000-0000-0000-000000000001', auth.uid()) returning 1) select count(*)::text from x $q$, '1');
select t.run('rls', 'admin', 'emails must be lowercase',
  $q$ with x as (insert into public.pending_access (email, registration_id) values ('Ravi@iitb.test', '20000000-0000-0000-0000-000000000001') returning 1) select count(*)::text from x $q$, 'ERROR 23514');
select t.run('rls', 'admin', 'admins can''t insert an entry as already claimed',
  $q$ with x as (insert into public.pending_access (email, registration_id, claimed_by, claimed_at) values ('x@iitb.test', '20000000-0000-0000-0000-000000000001', auth.uid(), now()) returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('rls', 'admin', 'admins revoke',
  $q$ with x as (update public.pending_access set revoked_at = now() where email = 'lead@nitt.test' returning 1) select count(*)::text from x $q$, '1');
select t.run('rls', 'admin', 'but can''t mark one claimed',
  $q$ with x as (update public.pending_access set claimed_by = auth.uid() where email = 'lead@nitt.test' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('rls', 'viewer', 'viewers read pending entries',
  $q$ select count(*)::text from public.pending_access $q$, '1');
select t.run('rls', 'viewer', 'viewers can''t add them',
  $q$ with x as (insert into public.pending_access (email, registration_id) values ('v@iitb.test', '20000000-0000-0000-0000-000000000001') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('rls', 'poc', 'POCs see no pending entries',
  $q$ select count(*)::text from public.pending_access $q$, '0');
select t.run('rls', 'anon', 'anon can''t read pending entries',
  $q$ select count(*)::text from public.pending_access $q$, 'ERROR 42501');
select t.run('rls', 'poc', 'POCs can''t read verified accounts',
  $q$ select count(*)::text from public.verified_accounts $q$, '0');
select t.run('rls', 'admin', 'admins read verified accounts',
  $q$ select count(*)::text from public.verified_accounts $q$, '3');
select t.run('rls', 'stranger', 'nobody writes verified accounts',
  $q$ with x as (insert into public.verified_accounts (user_id, method) values (auth.uid(), 'link') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('rls', 'stranger', 'the claim trigger function isn''t callable',
  $q$ select public.claim_pending_access()::text $q$, 'ERROR 42501');

-- ---------- Admin view + notifications ----------
select t.run('view', 'admin', 'poc_unverified: IIT Bombay has an unverified POC',
  $q$ select poc_unverified::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $q$, 'true');
select t.run('view', 'admin', 'NIT Trichy has nobody with access yet: not flagged',
  $q$ select poc_unverified::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000002' $q$, 'false');
select t.run('notify', 'postgres', 'payment notifications are allowed',
  $q$ with x as (insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-0000000000a3', 'payment', 'Prize paid') returning 1) select count(*)::text from x $q$, '1');
