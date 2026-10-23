-- =============================================================
-- Tests for 0006_always_open_registration.sql (scripts/db-test.sh). Each t.run is rolled back.
-- =============================================================

-- stranger registers through the real function (defaults: a new college, valid dates).
create function t.reg(p_name text default 'Open College') returns uuid language sql as $$
  select public.create_my_registration(null, p_name, 'india', 'sports@open.ac.in', 'open.ac.in', null,
    null, null, '2026-11-01', '2026-11-15', '2026-11-30', 'Sam', '9876543210');
$$;
-- Registers, then reads back as the same user: "<season name>|<rows this POC sees in registration_overview>".
create function t.reg_and_read() returns text language plpgsql as $$
declare v uuid;
begin
  v := t.reg();
  return (select l.name from public.registrations r join public.leagues l on l.id = r.league_id where r.id = v)
    || '|' || (select count(*) from public.registration_overview);
end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- ---------- Settings ----------
select t.run('settings', 'postgres', 'one settings row, not paused',
  $q$ select count(*) || '|' || bool_or(registrations_paused) from public.app_settings $q$, '1|false');
select t.run('settings', 'stranger', 'any signed-in user can read the pause switch',
  $q$ select registrations_paused::text from public.app_settings $q$, 'false');
select t.run('settings', 'anon', 'anon cannot read it',
  $q$ select count(*)::text from public.app_settings $q$, 'ERROR 42501');
select t.run('settings', 'admin', 'admin pauses; updated_by recorded',
  $q$ with x as (update public.app_settings set registrations_paused = true returning registrations_paused || '|' || (updated_by = auth.uid())) select * from x $q$, 'true|true');
select t.run('settings', 'viewer', 'viewer cannot pause',
  $q$ with x as (update public.app_settings set registrations_paused = true returning 1) select count(*)::text from x $q$, '0');
select t.run('settings', 'stranger', 'a POC/stranger cannot pause',
  $q$ with x as (update public.app_settings set registrations_paused = true returning 1) select count(*)::text from x $q$, '0');
select t.run('settings', 'admin', 'only the pause column is writable',
  $q$ with x as (update public.app_settings set updated_by = null returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('settings', 'admin', 'no second row',
  $q$ with x as (insert into public.app_settings (id) values (false) returning 1) select count(*)::text from x $q$, 'ERROR 42501');

-- ---------- Always open ----------
select t.run('open', 'stranger', 'season switch OFF + deadline passed: registration still works, joins Season 1',
  $q$ select t.reg_and_read() $q$, 'Matiks College League – Season 1|1');
select t.run('open', 'stranger', 'the completed (newer) Season 2 is skipped',
  $q$ select (t.reg() is not null)::text $q$, 'true / 10000000-0000-0000-0000-000000000001',
  $c$ select league_id::text from public.registrations where created_by = '00000000-0000-0000-0000-0000000000a6' $c$);
select t.run('open', 'stranger', 'pending, own, admins notified',
  $q$ select (t.reg() is not null)::text $q$, 'true / pending|2',
  $c$ select r.status || '|' || (select count(*) from public.notifications n where n.registration_id = r.id)
      from public.registrations r where r.created_by = '00000000-0000-0000-0000-0000000000a6' $c$);
select t.run('open', 'stranger', 'still one registration per user',
  $q$ select t.reg()::text || t.reg('Second')::text $q$, 'ERROR P0001');

-- Newest non-completed season is a draft: it's used, and the POC still sees its own row.
insert into public.leagues (id, name, slug, season, status) values ('10000000-0000-0000-0000-000000000003', 'Season 3 (draft)', 'mcl-s3', 3, 'draft');
select t.run('open', 'stranger', 'newest non-completed = the draft Season 3; POC can read it',
  $q$ select t.reg_and_read() $q$, 'Season 3 (draft)|1');
select t.run('open', 'stranger', 'a POC still cannot read other drafts',
  $q$ select count(*)::text from public.leagues where status = 'draft' $q$, '0');

-- No open season at all: the next one is created.
update public.leagues set status = 'completed' where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');
select t.run('open', 'stranger', 'all seasons completed → "Matiks College League – Season 4" is created',
  $q$ select t.reg_and_read() $q$, 'Matiks College League – Season 4|1 / 1|upcoming|mcl-season-4',
  $c$ select count(*) || '|' || min(status::text) || '|' || min(slug) from public.leagues where name = 'Matiks College League – Season 4' $c$);

delete from public.leagues;
select t.run('open', 'stranger', 'no seasons at all → "Matiks College League – Season 1"',
  $q$ select t.reg_and_read() $q$, 'Matiks College League – Season 1|1');
insert into public.leagues (id, name, slug, season, status) values ('10000000-0000-0000-0000-000000000001', 'Matiks College League – Season 1', 'mcl-s1', 1, 'upcoming');

-- ---------- The only "closed": paused ----------
update public.app_settings set registrations_paused = true;
select t.run('paused', 'stranger', 'paused → P0001 with the chat message',
  $q$ select t.reg()::text $q$, 'ERROR P0001: New registrations are paused. Message us in the Chat tab.');
update public.app_settings set registrations_paused = false;

-- ---------- Grants ----------
select t.run('grants', 'stranger', 'current_registration_season() is internal',
  $q$ select public.current_registration_season()::text $q$, 'ERROR 42501');
select t.run('grants', 'anon', 'anon still cannot register',
  $q$ select t.reg()::text $q$, 'ERROR 42501');
