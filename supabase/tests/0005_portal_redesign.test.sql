-- =============================================================
-- Tests for 0005_portal_redesign.sql. Run with scripts/db-test.sh (local Postgres + supabase-shim.sql).
-- Each test runs as one persona inside a rolled-back sub-transaction (see runner.sql).
-- =============================================================

-- Two more personas for this migration.
create or replace function t.claims(p text) returns text language sql immutable as $$
  select case p
    when 'anon'     then '{"role":"anon"}'
    when 'admin'    then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","email":"admin@matiks.test"}'
    when 'viewer'   then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a2","email":"viewer@matiks.test"}'
    when 'poc'      then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a3","email":"poc@iitb.test"}'
    when 'invited'  then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a4","email":"invited@iitb.test"}'
    when 'other'    then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a5","email":"poc@nitt.test"}'
    when 'stranger' then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a6","email":"stranger@gmail.test"}'
    when 'newbie'   then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a7","email":"newbie@gmail.test"}'
    when 'usa'      then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a8","email":"usa@mit.test"}'
    else ''
  end;
$$;

-- create_my_registration with sensible defaults (runs as the caller).
create function t.reg(
  p_college_id uuid default null, p_name text default 'Brand New College', p_domain text default 'bnc.ac.in',
  p_logo text default null, p_reg date default '2026-11-01', p_start date default '2026-11-15', p_end date default '2026-11-30'
) returns uuid language sql as $$
  select public.create_my_registration(p_college_id, p_name, 'india', 'sports@bnc.ac.in', p_domain, p_logo,
    'Coding Club', null, p_reg, p_start, p_end, 'Sam', '9876543210', 'instagram', null, null, null, 'AMB1');
$$;
-- Multi-statement steps (a CTE can't see its own insert).
create function t.mark_read_then_unread(p_thread uuid) returns int language plpgsql as $$
begin
  insert into public.chat_reads (thread_id, user_id) values (p_thread, auth.uid());
  return (select sum(unread) from public.my_chat_threads());
end $$;
create function t.resubmit_then_approve(p_reg uuid) returns text language plpgsql as $$
begin
  perform public.resubmit_my_registration(p_reg);
  update public.registrations set status = 'approved' where id = p_reg;
  return (select status::text from public.registrations where id = p_reg);
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- ---------- Fixtures ----------
update public.colleges set country = 'usa' where id = '11000000-0000-0000-0000-000000000003';

-- newbie self-registers (R4), the real way.
select set_config('request.jwt.claims', t.claims('newbie'), false);
set role authenticated;
select public.create_my_registration(null, 'Newbie Institute', 'india', 'hello@newbie.ac.in', 'newbie.ac.in',
  'https://x.supabase.co/storage/v1/object/public/logos/users/00000000-0000-0000-0000-0000000000a7/college.png',
  'Chess Club', null, '2026-11-01', '2026-11-15', '2026-11-30', 'Nia', '9123456780');
reset role;
select set_config('request.jwt.claims', '', false);

create table t.ids as
select (select id from public.registrations where created_by = '00000000-0000-0000-0000-0000000000a7') as r4,
       (select id from public.chat_threads where kind = 'admins') as admins_thread,
       (select id from public.chat_threads where registration_id = '20000000-0000-0000-0000-000000000001') as r1_thread,
       (select id from public.chat_threads where registration_id = '20000000-0000-0000-0000-000000000002') as r2_thread;
grant usage on schema t to authenticated; grant select on t.ids to anon, authenticated;

-- ---------- Backfill / schema ----------
select t.run('schema', 'postgres', 'existing colleges default to india',
  $q$ select string_agg(country::text, ',' order by name) from public.colleges where id in ('11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000002') $q$, 'india,india');
select t.run('schema', 'postgres', 'every registration has a college thread + one admins thread',
  $q$ select (select count(*) from public.registrations) || '|' || (select count(*) from public.chat_threads where kind = 'college') || '|' || (select count(*) from public.chat_threads where kind = 'admins') $q$, '4|4|1');
select t.run('schema', 'postgres', 'logos bucket: public, 2 MB, images only (no SVG)',
  $q$ select public || '|' || file_size_limit || '|' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'logos' $q$,
  'true|2097152|image/png,image/jpeg,image/webp');
select t.run('schema', 'postgres', 'realtime on chat_messages + notifications',
  $q$ select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime' $q$, 'chat_messages,notifications');

-- ---------- Self-registration ----------
select t.run('self-register', 'postgres', 'fixture: R4 pending, created_by, login email, attribution, primary contact, access',
  $q$ select r.status || '|' || (r.created_by = '00000000-0000-0000-0000-0000000000a7') || '|' || r.poc_email || '|' || r.email_domain || '|' || r.club_name
        || '|' || (select name || ':' || is_primary from public.contacts where registration_id = r.id)
        || '|' || (select count(*) from public.college_access where registration_id = r.id and user_id = r.created_by)
      from public.registrations r where r.id = (select r4 from t.ids) $q$,
  'pending|true|newbie@gmail.test|newbie.ac.in|Chess Club|Nia:true|1');
select t.run('self-register', 'postgres', 'fixture: admin + viewer notified, with a link to pending',
  $q$ select count(*) || '|' || min(link) from public.notifications where registration_id = (select r4 from t.ids) and kind = 'registration' $q$,
  '2|/admin/colleges?status=pending');
select t.run('self-register', 'stranger', 'stranger registers a new college (pending, own, thread created)',
  $q$ select (t.reg() is not null)::text $q$, 'true / pending|instagram|AMB1|1',
  $c$ select r.status || '|' || r.utm_source || '|' || r.referral_code || '|' || (select count(*) from public.chat_threads where registration_id = r.id)
      from public.registrations r where r.created_by = '00000000-0000-0000-0000-0000000000a6' $c$);
select t.run('self-register', 'stranger', 'stranger: new college is created with its country',
  $q$ select (t.reg(p_name => 'Fresh Uni') is not null)::text $q$, 'true / india',
  $c$ select c.country::text from public.registrations r join public.colleges c on c.id = r.college_id where r.created_by = '00000000-0000-0000-0000-0000000000a6' $c$);
select t.run('self-register', 'stranger', 'only one registration per user',
  $q$ select t.reg()::text || t.reg(p_name => 'Second College')::text $q$, 'ERROR P0001');
select t.run('self-register', 'newbie', 'newbie already has one',
  $q$ select t.reg(p_name => 'Another')::text $q$, 'ERROR P0001');
select t.run('self-register', 'poc', 'a POC (by poc_email) cannot self-register',
  $q$ select t.reg()::text $q$, 'ERROR P0001');
select t.run('self-register', 'invited', 'an invited POC (college_access) cannot self-register',
  $q$ select t.reg()::text $q$, 'ERROR P0001');
select t.run('self-register', 'admin', 'admins cannot self-register',
  $q$ select t.reg()::text $q$, 'ERROR P0001');
select t.run('self-register', 'anon', 'anon cannot call it',
  $q$ select t.reg()::text $q$, 'ERROR 42501');
select t.run('self-register', 'stranger', 'college already registered this season → 23505',
  $q$ select t.reg(p_college_id => '11000000-0000-0000-0000-000000000001')::text $q$, 'ERROR 23505');
select t.run('self-register', 'stranger', 'same college typed by name → 23505',
  $q$ select t.reg(p_name => 'iit-bombay')::text $q$, 'ERROR 23505');
select t.run('self-register', 'stranger', 'league end before league start → 23514',
  $q$ select t.reg(p_end => '2026-11-10')::text $q$, 'ERROR 23514');
select t.run('self-register', 'stranger', 'league start before registration start → 23514',
  $q$ select t.reg(p_reg => '2026-11-20')::text $q$, 'ERROR 23514');
select t.run('self-register', 'stranger', 'missing dates → P0001',
  $q$ select t.reg(p_start => null)::text $q$, 'ERROR P0001');
select t.run('self-register', 'stranger', 'invalid email domain → 23514',
  $q$ select t.reg(p_domain => 'not a domain')::text $q$, 'ERROR 23514');
select t.run('self-register', 'stranger', 'logo from someone else''s folder → P0001',
  $q$ select t.reg(p_logo => 'https://x.supabase.co/storage/v1/object/public/logos/users/00000000-0000-0000-0000-0000000000a7/college.png')::text $q$, 'ERROR P0001');
select t.run('self-register', 'stranger', 'logo hosted elsewhere → P0001',
  $q$ select t.reg(p_logo => 'https://evil.example/x.png')::text $q$, 'ERROR P0001');
select t.run('self-register', 'stranger', 'logo from own folder is fine',
  $q$ select (t.reg(p_logo => 'https://x.supabase.co/storage/v1/object/public/logos/users/00000000-0000-0000-0000-0000000000a6/c.png') is not null)::text $q$, 'true');
select t.run('self-register', 'stranger', 'cannot insert registrations directly',
  $q$ with x as (insert into public.registrations (league_id, college_id, poc_email) values ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'stranger@gmail.test') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
update public.leagues set registration_open = false;
select t.run('self-register', 'stranger', 'registration closed → P0001',
  $q$ select t.reg()::text $q$, 'ERROR P0001');
update public.leagues set registration_open = true;

-- ---------- POC edits ----------
select t.run('poc-edit', 'newbie', 'pending: POC edits details and dates',
  $q$ with x as (update public.registrations set college_email = 'new@newbie.ac.in', club_name = 'Math Soc', league_end = '2026-12-05'
       where id = (select r4 from t.ids) returning college_email || '|' || club_name || '|' || league_end) select * from x $q$,
  'new@newbie.ac.in|Math Soc|2026-12-05');
select t.run('poc-edit', 'newbie', 'POC cannot approve, set a deny reason, override stage or change created_by',
  $q$ with x as (update public.registrations set status = 'approved', deny_reason = 'x', stage_override = 'live', created_by = null
       where id = (select r4 from t.ids)
       returning status || '|' || coalesce(deny_reason, 'null') || '|' || coalesce(stage_override::text, 'null') || '|' || (created_by is not null)) select * from x $q$,
  'pending|null|null|true');
select t.run('poc-edit', 'other', 'approved: POC detail fields are locked',
  $q$ with x as (update public.registrations set league_start = '2027-01-01', club_name = 'X', team_name = 'Team N'
       where id = '20000000-0000-0000-0000-000000000002' returning coalesce(league_start::text, 'null') || '|' || coalesce(club_name, 'null') || '|' || team_name) select * from x $q$,
  'null|null|Team N');
select t.run('poc-edit', 'other', 'other POC cannot touch R4',
  $q$ with x as (update public.registrations set club_name = 'hack' where id = (select r4 from t.ids) returning 1) select count(*)::text from x $q$, '0');
select t.run('poc-edit', 'admin', 'admin sets dates + override on an approved registration',
  $q$ with x as (update public.registrations set league_start = '2026-11-15', stage_override = 'live' where id = '20000000-0000-0000-0000-000000000002'
       returning league_start || '|' || stage_override) select * from x $q$, '2026-11-15|live / 1',
  $c$ select count(*)::text from public.activity_log where field = 'stage_override' and registration_id = '20000000-0000-0000-0000-000000000002' $c$);

-- ---------- Review notifications + resubmit ----------
select t.run('review', 'admin', 'deny with reason → POC notified with the reason; logged with reason',
  $q$ with x as (update public.registrations set status = 'rejected', deny_reason = 'Dates clash with exams' where id = (select r4 from t.ids) returning 1) select count(*)::text from x $q$,
  '1 / Reason: Dates clash with exams|Dates clash with exams',
  $c$ select (select body from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a7' and kind = 'review')
      || '|' || (select meta ->> 'reason' from public.activity_log where registration_id = (select r4 from t.ids) and field = 'status') $c$);
select t.run('review', 'admin', 'approve R1 → both R1 POCs (poc_email + invited) notified',
  $q$ with x as (update public.registrations set status = 'approved' where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / 2',
  $c$ select count(*)::text from public.notifications where kind = 'review' and registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('review', 'newbie', 'resubmit only works on a denied registration',
  $q$ select public.resubmit_my_registration((select r4 from t.ids))::text $q$, 'ERROR P0001');

update public.registrations set status = 'rejected', deny_reason = 'Fix dates' where id = (select r4 from t.ids);
select t.run('review', 'newbie', 'denied: POC can still fix details',
  $q$ with x as (update public.registrations set league_end = '2026-12-10', status = 'approved' where id = (select r4 from t.ids) returning league_end || '|' || status) select * from x $q$,
  '2026-12-10|rejected');
select t.run('review', 'newbie', 'resubmit → pending, reason cleared, admins notified',
  $q$ select public.resubmit_my_registration((select r4 from t.ids))::text $q$, ' / pending|null|2',
  $c$ select r.status || '|' || coalesce(r.deny_reason, 'null') || '|' || (select count(*) from public.notifications where title like 'Resubmitted:%')
      from public.registrations r where r.id = (select r4 from t.ids) $c$);
select t.run('review', 'other', 'someone else cannot resubmit R4',
  $q$ select public.resubmit_my_registration((select r4 from t.ids))::text $q$, 'ERROR 42501');
select t.run('review', 'newbie', 'the bypass does not leak: approving right after resubmit is still blocked',
  $q$ select t.resubmit_then_approve((select r4 from t.ids)) $q$, 'pending');

-- ---------- Derived stage + overview ----------
select t.run('stage', 'admin', 'future league → Registration',
  $q$ with x as (update public.registrations set registration_start = current_date, league_start = current_date + 10, league_end = current_date + 20
       where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / registration_phase',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('stage', 'admin', 'between start and end → Live',
  $q$ with x as (update public.registrations set registration_start = current_date - 10, league_start = current_date - 5, league_end = current_date + 5
       where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / live',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('stage', 'admin', 'ended with an unpaid winner → Prize pending',
  $q$ with x as (update public.registrations set registration_start = current_date - 30, league_start = current_date - 20, league_end = current_date - 2
       where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / ended_prize_pending',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('stage', 'admin', 'ended and every winner paid → Complete',
  $q$ with x as (update public.registrations set registration_start = current_date - 30, league_start = current_date - 20, league_end = current_date - 2, stage_override = null
       where id = '20000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '1 / ended_prize_sent',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000002' $c$);
select t.run('stage', 'admin', 'ended with no winners yet → Prize pending',
  $q$ with x as (update public.registrations set registration_start = current_date - 30, league_start = current_date - 20, league_end = current_date - 2
       where id = '20000000-0000-0000-0000-000000000003' returning 1) select count(*)::text from x $q$, '1 / ended_prize_pending',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000003' $c$);
select t.run('stage', 'admin', 'admin override wins over the dates',
  $q$ with x as (update public.registrations set league_start = current_date + 10, league_end = current_date + 20, stage_override = 'ended_prize_sent'
       where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / ended_prize_sent',
  $c$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('stage', 'postgres', 'no dates → stored stage (older rows unchanged)',
  $q$ select effective_stage::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000003' $q$, 'registration_phase');
select t.run('overview', 'postgres', 'USA: no auto tier, prize pool = 0 until an admin sets it',
  $q$ select coalesce(auto_prize_pool::text, 'null') || '|' || prize_pool || '|' || country from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000003' $q$, 'null|0|usa');
select t.run('overview', 'admin', 'USA: the admin-set prize pool is used',
  $q$ with x as (update public.registrations set prize_pool_override = 500 where id = '20000000-0000-0000-0000-000000000003' returning 1) select count(*)::text from x $q$, '1 / 500',
  $c$ select prize_pool::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000003' $c$);
select t.run('overview', 'postgres', 'India keeps the auto tier',
  $q$ select auto_prize_pool || '|' || prize_pool from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000002' $q$, '10000|10000');
select t.run('overview', 'postgres', 'domain mismatch: gmail login vs newbie.ac.in',
  $q$ select domain_mismatch::text from public.registration_overview where registration_id = (select r4 from t.ids) $q$, 'true');
select t.run('overview', 'admin', 'domain match incl. subdomains (student.newbie.ac.in)',
  $q$ with x as (update public.registrations set poc_email = 'nia@student.newbie.ac.in' where id = (select r4 from t.ids) returning 1) select count(*)::text from x $q$, '1 / false',
  $c$ select domain_mismatch::text from public.registration_overview where registration_id = (select r4 from t.ids) $c$);
select t.run('overview', 'postgres', 'has_poc_access: self-registered yes, R2 (poc_email only) no',
  $q$ select (select has_poc_access from public.registration_overview where registration_id = (select r4 from t.ids)) || '|'
          || (select has_poc_access from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000002') $q$, 'true|false');
select t.run('overview', 'newbie', 'POC sees only own row in the view',
  $q$ select count(*)::text from public.registration_overview $q$, '1');
select t.run('overview', 'anon', 'anon cannot read the view',
  $q$ select count(*)::text from public.registration_overview $q$, 'ERROR 42501');

-- ---------- Chats ----------
insert into public.chat_messages (thread_id, sender_id, body) values
  ((select r1_thread from t.ids), '00000000-0000-0000-0000-0000000000a1', 'Welcome to the league!'),
  ((select admins_thread from t.ids), '00000000-0000-0000-0000-0000000000a1', 'Admins only');

select t.run('chat', 'postgres', 'sender name/role filled from the admin profile',
  $q$ select sender_name || '|' || sender_role from public.chat_messages where body = 'Welcome to the league!' $q$, 'Ananya Admin|admin');
select t.run('chat', 'poc', 'POC reads own college thread only (no admins thread)',
  $q$ select (select count(*) from public.chat_threads) || '|' || (select count(*) from public.chat_messages) $q$, '1|1');
select t.run('chat', 'invited', 'invited POC reads the same thread',
  $q$ select count(*)::text from public.chat_messages $q$, '1');
select t.run('chat', 'poc', 'POC posts in own thread; sender forced to them',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select r1_thread from t.ids), 'Hi team') returning sender_name || '|' || sender_role || '|' || (sender_id = auth.uid())) select * from x $q$,
  'Asha|poc|true');
select t.run('chat', 'poc', 'POC cannot spoof sender_id / role (column not granted)',
  $q$ with x as (insert into public.chat_messages (thread_id, body, sender_id, sender_role) values ((select r1_thread from t.ids), 'x', '00000000-0000-0000-0000-0000000000a1', 'admin') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'POC cannot post in another college''s thread',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select r2_thread from t.ids), 'x') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'POC cannot post in the admins thread',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select admins_thread from t.ids), 'x') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'stranger', 'stranger sees no threads or messages',
  $q$ select (select count(*) from public.chat_threads) || '|' || (select count(*) from public.chat_messages) $q$, '0|0');
select t.run('chat', 'viewer', 'viewer reads every thread',
  $q$ select (select count(*) from public.chat_threads) || '|' || (select count(*) from public.chat_messages) $q$, '5|2');
select t.run('chat', 'viewer', 'viewer cannot post',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select r1_thread from t.ids), 'x') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'admin', 'admin posts in the admins thread and any college thread',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select admins_thread from t.ids), 'a'), ((select r2_thread from t.ids), 'b') returning 1) select count(*)::text from x $q$, '2');
select t.run('chat', 'admin', 'nobody edits messages (admin either)',
  $q$ with x as (update public.chat_messages set body = 'edited' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'nobody deletes messages',
  $q$ with x as (delete from public.chat_messages returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'cannot create threads',
  $q$ with x as (insert into public.chat_threads (kind) values ('admins') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'admin', 'empty body rejected',
  $q$ with x as (insert into public.chat_messages (thread_id, body) values ((select r1_thread from t.ids), '   ') returning 1) select count(*)::text from x $q$, 'ERROR 23514');
select t.run('chat', 'anon', 'anon reads nothing',
  $q$ select count(*)::text from public.chat_messages $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'my_chat_threads: POC gets 1 thread with 1 unread',
  $q$ select count(*) || '|' || sum(unread) || '|' || min(college_name) from public.my_chat_threads() $q$, '1|1|IIT Bombay');
select t.run('chat', 'poc', 'marking read clears unread',
  $q$ select t.mark_read_then_unread((select r1_thread from t.ids))::text $q$, '0');
select t.run('chat', 'admin', 'my_chat_threads: admin gets all 5, admins thread first',
  $q$ select count(*) || '|' || (array_agg(kind))[1] from public.my_chat_threads() $q$, '5|admins');
select t.run('chat', 'poc', 'cannot mark another college''s thread read',
  $q$ with x as (insert into public.chat_reads (thread_id, user_id) values ((select r2_thread from t.ids), auth.uid()) returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('chat', 'poc', 'cannot write someone else''s read marker',
  $q$ with x as (insert into public.chat_reads (thread_id, user_id) values ((select r1_thread from t.ids), '00000000-0000-0000-0000-0000000000a4') returning 1) select count(*)::text from x $q$, 'ERROR 42501');

-- ---------- Notifications ----------
insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-0000000000a7', 'review', 'Welcome');
select t.run('notifications', 'newbie', 'user reads only own',
  $q$ select (count(*) > 0 and bool_and(user_id = auth.uid()))::text from public.notifications $q$, 'true');
select t.run('notifications', 'newbie', 'user marks own read',
  $q$ with x as (update public.notifications set read_at = now() returning 1) select (count(*) > 0)::text from x $q$, 'true');
select t.run('notifications', 'newbie', 'cannot change title',
  $q$ with x as (update public.notifications set title = 'hacked' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('notifications', 'newbie', 'cannot insert',
  $q$ with x as (insert into public.notifications (user_id, kind, title) values (auth.uid(), 'announcement', 'x') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('notifications', 'stranger', 'cannot mark someone else''s read',
  $q$ with x as (update public.notifications set read_at = now() where user_id = '00000000-0000-0000-0000-0000000000a7' returning 1) select count(*)::text from x $q$, '0');
select t.run('notifications', 'anon', 'anon reads nothing',
  $q$ select count(*)::text from public.notifications $q$, 'ERROR 42501');
select t.run('announce', 'admin', 'all India POCs, skipping USA and denied (R4): poc, invited, other',
  $q$ select string_agg(email, ',' order by email) from public.send_poc_notification('Hello', 'Body', 'all', 'india') $q$, 'invited@iitb.test,poc@iitb.test,poc@nitt.test');
select t.run('announce', 'admin', 'approved only (India): R2 POC',
  $q$ select string_agg(email, ',') from public.send_poc_notification('Hello', null, 'approved', 'india') $q$, 'poc@nitt.test');
select t.run('announce', 'admin', 'one college: R1 POCs only, rows created',
  $q$ select count(*)::text from public.send_poc_notification('Hi', null, 'college', null, '20000000-0000-0000-0000-000000000001') $q$, '2 / 2',
  $c$ select count(*)::text from public.notifications where kind = 'announcement' $c$);
select t.run('announce', 'admin', 'USA only: MIT POC',
  $q$ select string_agg(email, ',') from public.send_poc_notification('Hello', null, 'all', 'usa') $q$, 'usa@mit.test');
select t.run('announce', 'viewer', 'viewer cannot send',
  $q$ select count(*)::text from public.send_poc_notification('x', null, 'all') $q$, 'ERROR 42501');
select t.run('announce', 'poc', 'POC cannot send',
  $q$ select count(*)::text from public.send_poc_notification('x', null, 'all') $q$, 'ERROR 42501');
select t.run('announce', 'admin', 'college scope needs a college',
  $q$ select count(*)::text from public.send_poc_notification('x', null, 'college') $q$, 'ERROR 22023');

-- ---------- Logos storage ----------
select t.run('storage', 'stranger', 'upload to own users/ folder',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'users/00000000-0000-0000-0000-0000000000a6/c.png') returning 1) select count(*)::text from x $q$, '1');
select t.run('storage', 'stranger', 'not to someone else''s users/ folder',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'users/00000000-0000-0000-0000-0000000000a7/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('storage', 'newbie', 'POC uploads to own registration folder',
  $q$ with x as (insert into storage.objects (bucket_id, name) select 'logos', 'registrations/' || r4 || '/club.png' from t.ids returning 1) select count(*)::text from x $q$, '1');
select t.run('storage', 'newbie', 'not to another registration',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'registrations/20000000-0000-0000-0000-000000000001/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('storage', 'newbie', 'garbage folder name is refused, not an error',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'registrations/not-a-uuid/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('storage', 'newbie', 'no deeper paths or root files',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('storage', 'admin', 'admin uploads anywhere in logos',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'registrations/20000000-0000-0000-0000-000000000002/c.png') returning 1) select count(*)::text from x $q$, '1');
select t.run('storage', 'viewer', 'viewer cannot upload',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'registrations/20000000-0000-0000-0000-000000000002/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('storage', 'anon', 'anon cannot upload',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('logos', 'users/x/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
insert into storage.buckets (id, name) values ('other', 'other');
select t.run('storage', 'stranger', 'policies cover the logos bucket only',
  $q$ with x as (insert into storage.objects (bucket_id, name) values ('other', 'users/00000000-0000-0000-0000-0000000000a6/c.png') returning 1) select count(*)::text from x $q$, 'ERROR 42501');

-- ---------- Grants ----------
select t.run('grants', 'anon', 'anon cannot resubmit or announce',
  $q$ select public.resubmit_my_registration('20000000-0000-0000-0000-000000000001')::text $q$, 'ERROR 42501');
select t.run('grants', 'stranger', 'internal helpers are not callable',
  $q$ select count(*)::text from public.registration_poc_users('20000000-0000-0000-0000-000000000001') $q$, 'ERROR 42501');
select t.run('grants', 'stranger', 'notify_admins is not callable',
  $q$ select public.notify_admins('announcement', 'x', null, null, null)::text $q$, 'ERROR 42501');
