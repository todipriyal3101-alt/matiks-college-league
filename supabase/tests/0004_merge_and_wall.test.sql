-- Tests for 0004_merge_and_wall.sql (runner.sql is loaded first by scripts/db-test.sh).

-- ---------- merge_colleges ----------
select t.run('merge', 'service', 'clean merge: moves registration, match (+winner), ambassador; returns counts',
  $q$ select (r ->> 'registrations') || '|' || (r ->> 'matches') || '|' || (r ->> 'ambassadors') || '|' || (r ->> 'removed')
     from (select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-0000000000d1') r) x $q$,
  '1|1|1|Indian Institute of Technology Bombay / gone|IIT Bombay|Mumbai|https://iitb.ac.in|iit|winner=IIT Bombay|amb=IIT Bombay',
  $c$ select (case when exists (select 1 from public.colleges where id = '11000000-0000-0000-0000-0000000000d1') then 'still there' else 'gone' end)
        || '|' || k.name || '|' || k.city || '|' || k.website || '|' || k.college_type
        || '|winner=' || (select c.name from public.matches m join public.colleges c on c.id = m.winner_id where m.round = 'Group A')
        || '|amb=' || (select c.name from public.ambassadors a join public.colleges c on c.id = a.college_id where a.referral_code = 'RIYA101')
      from public.colleges k where k.id = '11000000-0000-0000-0000-0000000000a1' $c$);
select t.run('merge', 'service', 'merged registration now points at the kept college',
  $q$ select (select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-0000000000d1')) is not null $q$,
  'true / 11000000-0000-0000-0000-0000000000a1',
  $c$ select college_id::text from public.registrations where id = '20000000-0000-0000-0000-0000000000d1' $c$);
select t.run('merge', 'service', 'refuses when both registered for the same season (names the season)',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a2', '11000000-0000-0000-0000-0000000000d2')::text $q$,
  'ERROR P0001: Both colleges are registered for Brumble 2.0.');
select t.run('merge', 'service', 'refuses when they played each other',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a3', '11000000-0000-0000-0000-0000000000d3')::text $q$,
  'ERROR P0001: These colleges have a match against each other');
select t.run('merge', 'service', 'refuses merging a college into itself',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-0000000000a1')::text $q$,
  'ERROR P0001: Pick two different colleges.');
select t.run('merge', 'service', 'unknown college',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', gen_random_uuid())::text $q$, 'ERROR P0002');
select t.run('merge', 'service', 'a refused merge changes nothing',
  $q$ select (select count(*) from public.colleges)::text $q$, '7');
select t.run('merge', 'admin', 'admins cannot call it directly (server action + service role only)',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-0000000000d1')::text $q$, 'ERROR 42501');
select t.run('merge', 'anon', 'anon cannot call it',
  $q$ select public.merge_colleges('11000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-0000000000d1')::text $q$, 'ERROR 42501');

-- ---------- public_approved_colleges ----------
select t.run('wall', 'anon', 'anon sees approved colleges only (no pending/rejected)',
  $q$ select string_agg(name, ', ' order by name) from public.public_approved_colleges('10000000-0000-0000-0000-000000000001') $q$,
  'Anna University, Indian Institute of Technology Bombay');
select t.run('wall', 'anon', 'draft season shows nothing even if approved',
  $q$ select count(*)::text from public.public_approved_colleges('10000000-0000-0000-0000-000000000009') $q$, '0');
select t.run('wall', 'postgres', 'only public columns are returned (no emails/phones: CLAUDE.md rule 7)',
  $q$ select pg_get_function_result('public.public_approved_colleges(uuid)'::regprocedure) $q$,
  'TABLE(id uuid, name text, short_name text, city text, state text, logo_url text)');
select t.run('wall', 'anon', 'anon still cannot read registrations directly',
  $q$ select count(*)::text from public.registrations $q$, '0');
select t.run('wall', 'admin', 'admins can call it too',
  $q$ select count(*)::text from public.public_approved_colleges('10000000-0000-0000-0000-000000000001') $q$, '2');
