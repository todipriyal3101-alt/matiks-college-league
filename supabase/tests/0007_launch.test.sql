-- =============================================================
-- Tests for 0007_launch.sql (scripts/db-test.sh). Each t.run is rolled back.
-- =============================================================

-- ---------- Slugs ----------
select t.run('slug', 'postgres', 'backfilled from the names',
  $q$ select string_agg(slug, ',' order by created_at, id) from public.colleges $q$, 'iit-bombay,nit-trichy,mit,iit-delhi');
select t.run('slug', 'admin', 'a new college gets its slug',
  $q$ with x as (insert into public.colleges (name) values ('BITS Pilani') returning slug) select * from x $q$, 'bits-pilani');
select t.run('slug', 'admin', 'renaming keeps the slug (shared links keep working)',
  $q$ with x as (update public.colleges set name = 'Indian Institute of Technology Bombay' where id = '11000000-0000-0000-0000-000000000001' returning slug) select * from x $q$, 'iit-bombay');
select t.run('slug', 'admin', 'slugs are unique',
  $q$ with x as (update public.colleges set slug = 'iit-bombay' where id = '11000000-0000-0000-0000-000000000004' returning 1) select count(*)::text from x $q$, 'ERROR 23505');
-- An admin-edited slug takes a name's natural slug: the next college with that name gets -2.
update public.colleges set slug = 'bits-pilani' where id = '11000000-0000-0000-0000-000000000004';
select t.run('slug', 'admin', 'a taken slug gets -2',
  $q$ with x as (insert into public.colleges (name) values ('BITS Pilani') returning slug) select * from x $q$, 'bits-pilani-2');
update public.colleges set slug = 'iit-delhi' where id = '11000000-0000-0000-0000-000000000004';

-- ---------- Certificates ----------
select t.run('cert', 'postgres', 'backfill: approved registrations'' contacts have one; pending none',
  $q$ select string_agg(recipient_name, ',' order by recipient_name) from public.certificates $q$, 'Asha Kulkarni,Mia Chen');
select t.run('cert', 'postgres', 'ids look like MCL-XXXX-XXXX-XXXX and are distinct',
  $q$ select (bool_and(id ~ '^MCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$') and count(distinct id) = count(*))::text from public.certificates $q$, 'true');
select t.run('cert', 'admin', 'approving issues one per contact',
  $q$ with x as (update public.registrations set status = 'approved' where id = '20000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '1 / Neha Iyer',
  $c$ select string_agg(recipient_name, ',') from public.certificates where registration_id = '20000000-0000-0000-0000-000000000002' $c$);
select t.run('cert', 'admin', 'leaving approved withdraws them (Undo)',
  $q$ with x as (update public.registrations set status = 'pending' where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / 0',
  $c$ select count(*)::text from public.certificates where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('cert', 'poc', 'a contact added after approval gets one; renames follow',
  $q$ with x as (insert into public.contacts (registration_id, name, email) values ('20000000-0000-0000-0000-000000000001', 'Ravi', 'ravi@iitb.test') returning id)
      select count(*)::text from x $q$, '1 / Ravi',
  $c$ select string_agg(recipient_name, ',') from public.certificates where recipient_name = 'Ravi' $c$);
select t.run('cert', 'poc', 'rename follows',
  $q$ with x as (update public.contacts set name = 'Asha K' where id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / Asha K',
  $c$ select recipient_name from public.certificates where contact_id = '30000000-0000-0000-0000-000000000001' $c$);
create table t.cert as select id from public.certificates where contact_id = '30000000-0000-0000-0000-000000000001';
grant usage on schema t to anon, authenticated;
grant select on t.cert to anon, authenticated;
create function t.hide_then_verify() returns text language plpgsql as $$
begin
  update public.certificates set hidden = true where id = (select id from t.cert);
  return (select count(*)::text from public.public_certificate((select id from t.cert)));
end $$;
grant execute on function t.hide_then_verify() to authenticated;
select t.run('cert', 'anon', 'public_certificate shows a visible one',
  $q$ select recipient_name || '|' || college_name || '|' || season from public.public_certificate((select id from t.cert)) $q$,
  'Asha Kulkarni|IIT Bombay|Matiks College League – Season 1');
select t.run('cert', 'anon', 'ids are case-insensitive in the URL',
  $q$ select count(*)::text from public.public_certificate((select lower(id) from t.cert)) $q$, '1');
select t.run('cert', 'poc', 'POC hides their certificate → verify page has nothing',
  $q$ select t.hide_then_verify() $q$, '0');
select t.run('cert', 'poc', 'POC can only flip hidden (column grant)',
  $q$ with x as (update public.certificates set recipient_name = 'Fake' where contact_id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('cert', 'other', 'another POC cannot hide it',
  $q$ with x as (update public.certificates set hidden = true where contact_id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '0');
select t.run('cert', 'anon', 'anon cannot read the table',
  $q$ select count(*)::text from public.certificates $q$, 'ERROR 42501');
select t.run('cert', 'other', 'a pending college''s POC sees no certificates',
  $q$ select count(*)::text from public.certificates $q$, '0');

-- ---------- Badges ----------
select t.run('badges', 'postgres', 'backfill: R1 early bird + 200 club; R3 early bird + 200/400/600',
  $q$ select string_agg(registration_id::text || ':' || badge, ',' order by registration_id, badge) from public.badges $q$,
  '20000000-0000-0000-0000-000000000001:club_200,20000000-0000-0000-0000-000000000001:early_bird,20000000-0000-0000-0000-000000000003:club_200,20000000-0000-0000-0000-000000000003:club_400,20000000-0000-0000-0000-000000000003:club_600,20000000-0000-0000-0000-000000000003:early_bird');
select t.run('badges', 'poc', 'adding contacts up to 3 → Full squad + a notification',
  $q$ with x as (insert into public.contacts (registration_id, name, email) values ('20000000-0000-0000-0000-000000000001', 'B', 'b@x.test'), ('20000000-0000-0000-0000-000000000001', 'C', 'c@x.test') returning 1)
      select count(*)::text from x $q$, '2 / 1|Badge earned: Full squad',
  $c$ select (select count(*) from public.badges where registration_id = '20000000-0000-0000-0000-000000000001' and badge = 'full_squad') || '|' ||
             (select max(title) from public.notifications where kind = 'badge' and title like '%Full squad') $c$);
select t.run('badges', 'admin', 'participants 410 → 400 club',
  $q$ with x as (update public.registrations set participant_count = 410 where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / 1',
  $c$ select count(*)::text from public.badges where registration_id = '20000000-0000-0000-0000-000000000001' and badge = 'club_400' $c$);
update public.registrations set league_start = current_date - 20, league_end = current_date - 2 where id = '20000000-0000-0000-0000-000000000003';
select t.run('badges', 'admin', 'league over + every winner paid → Champion',
  $q$ with x as (insert into public.winners (registration_id, position, payment_status) values ('20000000-0000-0000-0000-000000000003', '1st', 'paid') returning 1) select count(*)::text from x $q$, '1 / 1',
  $c$ select count(*)::text from public.badges where registration_id = '20000000-0000-0000-0000-000000000003' and badge = 'champion' $c$);
select t.run('badges', 'poc', 'POC reads own badges only',
  $q$ select string_agg(distinct registration_id::text, ',') from public.badges $q$, '20000000-0000-0000-0000-000000000001');
select t.run('badges', 'poc', 'POC cannot award badges',
  $q$ with x as (insert into public.badges (registration_id, badge) values ('20000000-0000-0000-0000-000000000001', 'champion') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('badges', 'poc', 'refresh_my_badges works for own registration',
  $q$ select coalesce(array_length(public.refresh_my_badges('20000000-0000-0000-0000-000000000001'), 1), 0)::text $q$, '0');
select t.run('badges', 'other', 'refresh_my_badges refuses others',
  $q$ select public.refresh_my_badges('20000000-0000-0000-0000-000000000001')::text $q$, 'ERROR 42501');
select t.run('badges', 'stranger', 'refresh_badges is internal',
  $q$ select public.refresh_badges('20000000-0000-0000-0000-000000000001')::text $q$, 'ERROR 42501');

-- ---------- Invite links ----------
select t.run('invite', 'poc', 'POC gets a code (first name from their contact), idempotent',
  $q$ select (a.code = b.code and a.code ~ '^[a-z0-9]{10}$')::text || '|' || a.plays || '|' || a.registrations
      from public.my_invite('20000000-0000-0000-0000-000000000001') a, public.my_invite('20000000-0000-0000-0000-000000000001') b $q$, 'true|0|0');
select t.run('invite', 'stranger', 'non-POC refused',
  $q$ select code from public.my_invite('20000000-0000-0000-0000-000000000001') $q$, 'ERROR 42501');
select t.run('invite', 'anon', 'anon refused',
  $q$ select code from public.my_invite('20000000-0000-0000-0000-000000000001') $q$, 'ERROR 42501');

-- Fixture: R1's POC code + 5 people through it (3 duel plays, 2 registrations) → Recruiter.
insert into public.invite_codes (code, kind, user_id, registration_id, display_name, college_id)
values ('abcde12345', 'poc', '00000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-000000000001', 'Asha', '11000000-0000-0000-0000-000000000001');
insert into public.invite_codes (code, kind, display_name, college_id, score)
values ('player0001', 'player', 'Kiran', '11000000-0000-0000-0000-000000000002', 14);
select t.run('invite', 'anon', 'public_invite: first name, college, score (no other PII)',
  $q$ select kind || '|' || display_name || '|' || college_name || '|' || coalesce(score::text, 'null') from public.public_invite('player0001') $q$, 'player|Kiran|NIT Trichy|14');
select t.run('invite', 'poc', 'POC cannot set a registration''s invite_code (server only)',
  $q$ with x as (update public.registrations set invite_code = 'player0001' where id = '20000000-0000-0000-0000-000000000001' returning coalesce(invite_code, 'null')) select * from x $q$, 'null');
-- Multi-step (a CTE can't update its own inserts): 3 submitted plays + 2 registrations through R1's code.
create function t.recruit() returns text language plpgsql as $$
declare v_ids uuid[];
begin
  with d as (insert into public.duel_rounds (seed, ip_hash, expires_at, invite_code)
             select 1, 'h', now() + interval '1 min', 'abcde12345' from generate_series(1, 3) returning id)
  select array_agg(id) into v_ids from d;
  update public.duel_rounds set submitted_at = now(), score = 5 where id = any (v_ids);
  update public.registrations set invite_code = 'abcde12345' where id in ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003');
  return (select count(*) from public.badges where registration_id = '20000000-0000-0000-0000-000000000001' and badge = 'recruiter')::text;
end $$;
select t.run('invite', 'postgres', '5 people via the link → Recruiter (+ notification)',
  $q$ select t.recruit() $q$, '1 / 1',
  $c$ select count(*)::text from public.notifications where kind = 'badge' and title = 'Badge earned: Recruiter' $c$);
select t.recruit();  -- persistent from here on
select t.run('invite', 'poc', 'my_invite counts plays + registrations through the link',
  $q$ select plays || '|' || registrations from public.my_invite('20000000-0000-0000-0000-000000000001') $q$, '3|2');
select t.run('invite', 'admin', 'admin_top_inviters lists inviters with people brought in',
  $q$ select string_agg(code || ':' || plays || ':' || registrations, ',') from public.admin_top_inviters() $q$, 'abcde12345:3:2');
select t.run('invite', 'poc', 'admin_top_inviters is admins only',
  $q$ select count(*)::text from public.admin_top_inviters() $q$, 'ERROR 42501');

-- ---------- Public functions ----------
select t.run('public', 'anon', 'college race: approved only, India, public columns',
  $q$ select string_agg(name || ':' || players || ':' || coalesce(prize_pool::text, 'null') || ':' || slug, ',') from public.public_college_race('india') $q$,
  'IIT Bombay:250:5000:iit-bombay');
select t.run('public', 'anon', 'college race USA: no prize pool (manual), players shown',
  $q$ select string_agg(name || ':' || players || ':' || coalesce(prize_pool::text, 'null'), ',') from public.public_college_race('usa') $q$, 'MIT:700:null');
select t.run('public', 'anon', 'state counts (approved only)',
  $q$ select string_agg(state || ':' || colleges, ',') from public.public_state_counts('india') $q$, 'Maharashtra:1');
select t.run('public', 'anon', 'home stats: approved colleges, players, next league start, season',
  $q$ select colleges || '|' || players || '|' || (next_league_start = current_date + 3) || '|' || season from public.public_home_stats() $q$,
  '2|950|true|Matiks College League – Season 1');
update public.registrations set league_start = current_date - 5 where id = '20000000-0000-0000-0000-000000000001';
select t.run('public', 'anon', 'home stats: no upcoming start → null (UI shows "Registrations open")',
  $q$ select coalesce(next_league_start::text, 'null') from public.public_home_stats() $q$, 'null');
update public.registrations set league_start = current_date + 3 where id = '20000000-0000-0000-0000-000000000001';
select t.run('public', 'anon', 'public_college by slug (approved only) with badges',
  $q$ select name || '|' || players || '|' || array_to_string(badges, ',') from public.public_college('iit-bombay') $q$, 'IIT Bombay|250|early_bird,club_200,recruiter');
select t.run('public', 'anon', 'pending college has no public page',
  $q$ select count(*)::text from public.public_college('nit-trichy') $q$, '0');

-- ---------- Top today (midnight IST) + duel rounds ----------
insert into public.duel_rounds (seed, ip_hash, expires_at, submitted_at, score, player_name, college_id, hidden) values
  (1, 'a', now(), now(), 12, 'Kiran', '11000000-0000-0000-0000-000000000002', false),
  (2, 'a', now(), now(), 18, 'Kiran', '11000000-0000-0000-0000-000000000002', false),  -- same person: best only
  (3, 'b', now(), now(), 25, 'Troll', null, true),                                     -- hidden by admins
  (4, 'c', now(), now(), 9, 'Meera', '11000000-0000-0000-0000-000000000001', false),
  (5, 'd', now(), ((now() at time zone 'Asia/Kolkata')::date - 1)::timestamp at time zone 'Asia/Kolkata', 30, 'Yesterday', null, false),
  (6, 'e', now(), now(), 50, null, null, false);                                       -- no name: not on the board
select t.run('duel', 'anon', 'top today: best per person, hidden/yesterday/nameless excluded',
  $q$ select string_agg(player_name || ':' || score || ':' || coalesce(college_name, '-'), ',') from public.top_duels_today(10) $q$,
  'Kiran:18:NIT Trichy,Meera:9:IIT Bombay');
select t.run('duel', 'anon', 'anon cannot read or write duel rounds directly',
  $q$ select count(*)::text from public.duel_rounds $q$, 'ERROR 42501');
select t.run('duel', 'anon', 'anon cannot insert a round',
  $q$ with x as (insert into public.duel_rounds (seed, ip_hash, expires_at, score) values (1, 'x', now(), 200) returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('duel', 'stranger', 'signed-in users cannot either',
  $q$ select count(*)::text from public.duel_rounds $q$, '0');
select t.run('duel', 'admin', 'admin hides an entry',
  $q$ with x as (update public.duel_rounds set hidden = true where player_name = 'Meera' returning 1) select count(*)::text from x $q$, '1');
select t.run('duel', 'admin', 'admin can only change hidden',
  $q$ with x as (update public.duel_rounds set score = 99 where player_name = 'Meera' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('duel', 'viewer', 'viewer cannot hide',
  $q$ with x as (update public.duel_rounds set hidden = true where player_name = 'Meera' returning 1) select count(*)::text from x $q$, '0');

-- ---------- Grants ----------
select t.run('grants', 'anon', 'anon reads no new tables',
  $q$ select count(*)::text from public.invite_codes $q$, 'ERROR 42501');
select t.run('grants', 'stranger', 'internal helpers not callable',
  $q$ select public.new_invite_code() $q$, 'ERROR 42501');
