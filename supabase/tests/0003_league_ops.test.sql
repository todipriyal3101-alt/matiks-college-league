-- =============================================================
-- Tests for 0003_league_ops.sql. Run with scripts/db-test.sh (local Postgres + supabase-shim.sql).
-- Every test runs as one persona inside a sub-transaction that is rolled back, so tests are independent.
-- Expected "ERROR 42501" etc. matches the SQLSTATE prefix; anything else must match exactly.
-- =============================================================

-- ---------- Post-0003 fixtures ----------
insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

insert into public.college_access (user_id, registration_id, invited_by) values
  ('00000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');

update public.registrations set participant_count = 250 where id = '20000000-0000-0000-0000-000000000001';
update public.registrations set participant_count = 610 where id = '20000000-0000-0000-0000-000000000002';

-- W1 pending ₹5,000; W2 paid ₹3,000.
insert into public.winners (id, registration_id, position, name, prize_amount, upi_id) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '1st', 'Kiran', 5000, 'kiran@okicici');
insert into public.winners (id, registration_id, position, name, prize_amount, payment_status, payment_reference) values
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '2nd', 'Meera', 3000, 'paid', 'UTR0001');

-- ---------- Backfill ----------
select t.run('backfill', 'postgres', 'R1 primary = earliest poc contact (Asha)',
  $q$ select string_agg(name, ',') from public.contacts where is_primary and registration_id = '20000000-0000-0000-0000-000000000001' $q$, 'Asha');
select t.run('backfill', 'postgres', 'R2 primary = poc (Neha), not the earlier faculty contact',
  $q$ select string_agg(name, ',') from public.contacts where is_primary and registration_id = '20000000-0000-0000-0000-000000000002' $q$, 'Neha');
select t.run('backfill', 'postgres', 'every registration with contacts has exactly 1 primary',
  $q$ select count(*)::text from (select registration_id from public.contacts group by 1 having count(*) filter (where is_primary) <> 1) x $q$, '0');

-- ---------- Registrations: admin-only fields ----------
select t.run('registrations', 'poc', 'POC edits team name; stage/participants/override/status silently kept',
  $q$ with x as (update public.registrations set stage = 'live', participant_count = 999, prize_pool_override = 1, status = 'approved', team_name = 'Team X'
       where id = '20000000-0000-0000-0000-000000000001'
       returning stage::text || '|' || participant_count || '|' || coalesce(prize_pool_override::text, 'null') || '|' || status::text || '|' || team_name)
     select * from x $q$, 'registration_phase|250|null|pending|Team X');
select t.run('registrations', 'invited', 'invited POC edits team name only',
  $q$ with x as (update public.registrations set stage = 'live', team_name = 'Invited team' where id = '20000000-0000-0000-0000-000000000001'
       returning stage::text || '|' || team_name) select * from x $q$, 'registration_phase|Invited team');
select t.run('registrations', 'viewer', 'viewer cannot update',
  $q$ with x as (update public.registrations set stage = 'live' where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '0');
select t.run('registrations', 'other', 'other college POC cannot update R1',
  $q$ with x as (update public.registrations set team_name = 'hack' where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '0');
select t.run('registrations', 'stranger', 'stranger cannot update',
  $q$ with x as (update public.registrations set team_name = 'hack' returning 1) select count(*)::text from x $q$, '0');
select t.run('registrations', 'anon', 'anon cannot update',
  $q$ with x as (update public.registrations set team_name = 'hack' returning 1) select count(*)::text from x $q$, '0');
select t.run('registrations', 'anon', 'anon reads no registrations',
  $q$ select count(*)::text from public.registrations $q$, '0');
select t.run('registrations', 'admin', 'admin sets stage + participants; both logged with actor email',
  $q$ with x as (update public.registrations set stage = 'live', participant_count = 420 where id = '20000000-0000-0000-0000-000000000001'
       returning stage::text || '|' || participant_count) select * from x $q$, 'live|420 / 2|admin@matiks.test',
  $c$ select count(*)::text || '|' || max(actor_email) from public.activity_log
      where registration_id = '20000000-0000-0000-0000-000000000001' and field in ('stage', 'participant_count') and actor_email is not null $c$);
select t.run('registrations', 'admin', 'admin override wins over auto tier in the view',
  $q$ with x as (update public.registrations set prize_pool_override = 9000 where id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$,
  '1 / 5000|9000',
  $c$ select auto_prize_pool || '|' || prize_pool from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $c$);

-- ---------- Contacts ----------
select t.run('contacts', 'poc', 'POC adds a 3rd contact; merch + is_primary forced off',
  $q$ with x as (insert into public.contacts (registration_id, name, email, merch_description, merch_sent, is_primary)
       values ('20000000-0000-0000-0000-000000000001', 'Zoya', 'zoya@iitb.test', 'hoodie', true, true)
       returning is_primary || '|' || merch_sent || '|' || coalesce(merch_description, 'null')) select * from x $q$, 'false|false|null');
select t.run('contacts', 'poc', 'POC cannot exceed 3 contacts',
  $q$ with x as (insert into public.contacts (registration_id, name, email) values
       ('20000000-0000-0000-0000-000000000001', 'C3', 'c3@x'), ('20000000-0000-0000-0000-000000000001', 'C4', 'c4@x') returning 1)
     select count(*)::text from x $q$, 'ERROR 23514');
select t.run('contacts', 'admin', 'max 3 applies to admins too',
  $q$ with x as (insert into public.contacts (registration_id, name, email) values
       ('20000000-0000-0000-0000-000000000001', 'C3', 'c3@x'), ('20000000-0000-0000-0000-000000000001', 'C4', 'c4@x') returning 1)
     select count(*)::text from x $q$, 'ERROR 23514');
select t.run('contacts', 'poc', 'POC edits a contact; merch/is_primary changes ignored',
  $q$ with x as (update public.contacts set name = 'Ravi K', merch_sent = true, merch_description = 'x', is_primary = true
       where id = '30000000-0000-0000-0000-000000000002'
       returning name || '|' || merch_sent || '|' || coalesce(merch_description, 'null') || '|' || is_primary) select * from x $q$, 'Ravi K|false|null|false');
select t.run('contacts', 'poc', 'POC cannot un-primary the primary',
  $q$ with x as (update public.contacts set is_primary = false where id = '30000000-0000-0000-0000-000000000001' returning is_primary::text) select * from x $q$, 'true');
select t.run('contacts', 'poc', 'POC cannot delete the primary contact',
  $q$ with x as (delete from public.contacts where id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('contacts', 'poc', 'POC can delete a non-primary contact',
  $q$ with x as (delete from public.contacts where id = '30000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '1');
select t.run('contacts', 'other', 'other college POC cannot edit R1 contacts',
  $q$ with x as (update public.contacts set name = 'hack' where registration_id = '20000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '0');
select t.run('contacts', 'viewer', 'viewer reads all contacts but cannot edit',
  $q$ with x as (update public.contacts set name = 'hack' returning 1) select count(*)::text from x $q$, '0 / 4',
  $c$ select count(*)::text from public.contacts $c$);
select t.run('contacts', 'admin', 'admin marks merch sent: merch_sent_at set + logged',
  $q$ with x as (update public.contacts set merch_sent = true, merch_description = 'Matiks hoodie' where id = '30000000-0000-0000-0000-000000000001'
       returning merch_sent || '|' || (merch_sent_at is not null)) select * from x $q$, 'true|true / 1',
  $c$ select count(*)::text from public.activity_log where entity = 'contact' and field = 'merch_sent' $c$);
select t.run('contacts', 'admin', 'admin deletes the primary → next contact promoted',
  $q$ with x as (delete from public.contacts where id = '30000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / Ravi',
  $c$ select string_agg(name, ',') from public.contacts where is_primary and registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('contacts', 'admin', 'first contact of a registration becomes primary automatically',
  $q$ with x as (insert into public.contacts (registration_id, name, email) values ('20000000-0000-0000-0000-000000000003', 'Dev', 'dev@bits.test')
       returning is_primary::text) select * from x $q$, 'true');

-- ---------- Winners ----------
select t.run('winners', 'poc', 'POC adds winner; prize/merch/payment forced to defaults; logged',
  $q$ with x as (insert into public.winners (registration_id, position, name, prize_type, prize_amount, payment_status, merch_sent, payment_reference, paid_at)
       values ('20000000-0000-0000-0000-000000000001', '3rd', 'Isha', 'merch_only', 5000, 'paid', true, 'FAKE', now())
       returning prize_type || '|' || prize_amount || '|' || payment_status || '|' || merch_sent || '|' || coalesce(payment_reference, 'null') || '|' || coalesce(paid_at::text, 'null'))
     select * from x $q$, 'cash|0|pending|false|null|null / 3rd|poc@iitb.test',
  $c$ select new_value || '|' || actor_email from public.activity_log where entity = 'winner' and action = 'added' and meta ->> 'name' = 'Isha' $c$);
select t.run('winners', 'poc', 'POC edits unpaid winner details; prize/payment changes ignored; UPI change logged',
  $q$ with x as (update public.winners set name = 'Ananya', upi_id = 'ananya@okaxis', prize_amount = 99999, payment_status = 'paid'
       where id = '40000000-0000-0000-0000-000000000001'
       returning name || '|' || upi_id || '|' || prize_amount || '|' || payment_status) select * from x $q$, 'Ananya|ananya@okaxis|5000|pending / upi_id',
  $c$ select string_agg(field, ',') from public.activity_log where entity = 'winner' and action = 'changed' $c$);
select t.run('winners', 'poc', 'POC cannot edit a paid winner (raises)',
  $q$ with x as (update public.winners set name = 'Changed' where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('winners', 'poc', 'POC saving a paid winner unchanged is a no-op, not an error',
  $q$ with x as (update public.winners set name = name where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '1');
select t.run('winners', 'poc', 'POC cannot delete a paid winner',
  $q$ with x as (delete from public.winners where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '0');
select t.run('winners', 'poc', 'POC can delete an unpaid winner',
  $q$ with x as (delete from public.winners where id = '40000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1');
select t.run('winners', 'poc', 'POC cannot add a winner to another college',
  $q$ with x as (insert into public.winners (registration_id, position) values ('20000000-0000-0000-0000-000000000002', '1st') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('winners', 'invited', 'invited POC reads + edits R1 winners',
  $q$ with x as (update public.winners set name = 'Kiran S' where id = '40000000-0000-0000-0000-000000000001' returning 1) select count(*)::text from x $q$, '1 / 2',
  $c$ select count(*)::text from public.winners where registration_id = '20000000-0000-0000-0000-000000000001' $c$);
select t.run('winners', 'other', 'other college POC sees no R1 winners',
  $q$ select count(*)::text from public.winners $q$, '0');
select t.run('winners', 'stranger', 'stranger sees no winners',
  $q$ select count(*)::text from public.winners $q$, '0');
select t.run('winners', 'viewer', 'viewer reads winners',
  $q$ select count(*)::text from public.winners $q$, '2');
select t.run('winners', 'viewer', 'viewer cannot update or delete winners',
  $q$ with u as (update public.winners set name = 'x' returning 1), d as (delete from public.winners returning 1)
     select (select count(*) from u) || '|' || (select count(*) from d) $q$, '0|0');
select t.run('winners', 'anon', 'anon has no access to winners',
  $q$ select count(*)::text from public.winners $q$, 'ERROR 42501');
select t.run('winners', 'admin', 'admin marks paid with UTR: paid_at set, logged with UTR',
  $q$ with x as (update public.winners set payment_status = 'paid', payment_reference = 'UTR123456' where id = '40000000-0000-0000-0000-000000000001'
       returning payment_status || '|' || (paid_at is not null)) select * from x $q$, 'paid|true / UTR123456',
  $c$ select meta ->> 'payment_reference' from public.activity_log where field = 'payment_status' $c$);
select t.run('winners', 'admin', 'admin can still edit a paid winner (amount logged)',
  $q$ with x as (update public.winners set prize_amount = 3500 where id = '40000000-0000-0000-0000-000000000002' returning prize_amount::text) select * from x $q$, '3500 / 3000→3500',
  $c$ select old_value || '→' || new_value from public.activity_log where field = 'prize_amount' $c$);
select t.run('winners', 'admin', 'admin marks unpaid again: paid_at cleared',
  $q$ with x as (update public.winners set payment_status = 'pending' where id = '40000000-0000-0000-0000-000000000002' returning coalesce(paid_at::text, 'null')) select * from x $q$, 'null');
select t.run('winners', 'admin', 'admin can delete a paid winner',
  $q$ with x as (delete from public.winners where id = '40000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, '1');
select t.run('winners', 'admin', 'admin merch sent: merch_sent_at set',
  $q$ with x as (update public.winners set merch_sent = true where id = '40000000-0000-0000-0000-000000000001' returning (merch_sent_at is not null)::text) select * from x $q$, 'true');

-- ---------- Activity log ----------
select t.run('activity_log', 'poc', 'POC cannot insert',
  $q$ with x as (insert into public.activity_log (registration_id, entity, entity_id, action) values ('20000000-0000-0000-0000-000000000001', 'winner', gen_random_uuid(), 'added') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('activity_log', 'admin', 'admin cannot insert',
  $q$ with x as (insert into public.activity_log (registration_id, entity, entity_id, action) values ('20000000-0000-0000-0000-000000000001', 'winner', gen_random_uuid(), 'added') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('activity_log', 'service', 'service_role cannot insert',
  $q$ with x as (insert into public.activity_log (registration_id, entity, entity_id, action) values ('20000000-0000-0000-0000-000000000001', 'winner', gen_random_uuid(), 'added') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('activity_log', 'poc', 'POC cannot update the log',
  $q$ with x as (update public.activity_log set new_value = 'x' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('activity_log', 'admin', 'admin cannot delete the log',
  $q$ with x as (delete from public.activity_log returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('activity_log', 'poc', 'POC calling log_activity() directly is denied',
  $q$ select public.log_activity('20000000-0000-0000-0000-000000000001', 'winner', gen_random_uuid(), 'added', null, null, null, null)::text $q$, 'ERROR 42501');
select t.run('activity_log', 'poc', 'POC reads only own registration log',
  $q$ select string_agg(distinct registration_id::text, ',') from public.activity_log $q$, '20000000-0000-0000-0000-000000000001');
select t.run('activity_log', 'viewer', 'viewer reads all logs',
  $q$ select count(distinct registration_id)::text from public.activity_log $q$, '2');
select t.run('activity_log', 'stranger', 'stranger reads nothing',
  $q$ select count(*)::text from public.activity_log $q$, '0');
select t.run('activity_log', 'anon', 'anon has no access',
  $q$ select count(*)::text from public.activity_log $q$, 'ERROR 42501');

-- ---------- College access ----------
select t.run('college_access', 'poc', 'POC cannot grant themselves access',
  $q$ with x as (insert into public.college_access (user_id, registration_id) values ('00000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-000000000002') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('college_access', 'invited', 'invited POC sees own access row',
  $q$ select count(*)::text from public.college_access $q$, '1');
select t.run('college_access', 'other', 'others see no access rows',
  $q$ select count(*)::text from public.college_access $q$, '0');
select t.run('college_access', 'viewer', 'viewer sees all, cannot add',
  $q$ with x as (insert into public.college_access (user_id, registration_id) values ('00000000-0000-0000-0000-0000000000a6', '20000000-0000-0000-0000-000000000001') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('college_access', 'admin', 'admin invites a POC → that user can read R1',
  $q$ with x as (insert into public.college_access (user_id, registration_id, invited_by) values ('00000000-0000-0000-0000-0000000000a6', '20000000-0000-0000-0000-000000000001', auth.uid()) returning 1) select count(*)::text from x $q$, '1');
select t.run('college_access', 'anon', 'anon has no access',
  $q$ select count(*)::text from public.college_access $q$, 'ERROR 42501');

-- ---------- registration_overview ----------
select t.run('overview', 'admin', 'admin sees every registration',
  $q$ select count(*)::text from public.registration_overview $q$, '3');
select t.run('overview', 'admin', 'R1 row: auto|override|pool|winners|paid|paid ₹|contacts|merch|primary|source',
  $q$ select concat_ws('|', auto_prize_pool, coalesce(prize_pool_override::text, 'null'), prize_pool, winners_total, winners_paid, prize_paid_amount,
       contacts_total, contacts_merch_sent, primary_poc_name, utm_source)
     from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000001' $q$, '5000|null|5000|2|1|3000|2|0|Asha|instagram');
select t.run('overview', 'admin', 'R2 (610 participants) auto tier ₹10,000',
  $q$ select auto_prize_pool::text from public.registration_overview where registration_id = '20000000-0000-0000-0000-000000000002' $q$, '10000');
select t.run('overview', 'viewer', 'viewer sees every registration',
  $q$ select count(*)::text from public.registration_overview $q$, '3');
select t.run('overview', 'poc', 'POC (case-insensitive poc_email) sees only their college',
  $q$ select string_agg(college_name, ',') from public.registration_overview $q$, 'IIT Bombay');
select t.run('overview', 'invited', 'invited POC sees only their college',
  $q$ select string_agg(college_name, ',') from public.registration_overview $q$, 'IIT Bombay');
select t.run('overview', 'stranger', 'stranger sees nothing',
  $q$ select count(*)::text from public.registration_overview $q$, '0');
select t.run('overview', 'anon', 'anon has no access',
  $q$ select count(*)::text from public.registration_overview $q$, 'ERROR 42501');

-- ---------- Functions ----------
select t.run('functions', 'postgres', 'calc_prize_pool tiers at 0/199/200/399/400/599/600/5000',
  $q$ select string_agg(public.calc_prize_pool(n)::text, ',' order by n) from unnest(array[0,199,200,399,400,599,600,5000]) n $q$,
  '3000,3000,5000,5000,7500,7500,10000,10000');
select t.run('functions', 'service', 'service_role: find_user_id_by_email (case/space-insensitive)',
  $q$ select public.find_user_id_by_email('  ADMIN@matiks.test ')::text $q$, '00000000-0000-0000-0000-0000000000a1');
select t.run('functions', 'admin', 'admin cannot call find_user_id_by_email',
  $q$ select public.find_user_id_by_email('admin@matiks.test')::text $q$, 'ERROR 42501');
select t.run('functions', 'anon', 'anon cannot call find_user_id_by_email',
  $q$ select public.find_user_id_by_email('admin@matiks.test')::text $q$, 'ERROR 42501');
select t.run('functions', 'anon', 'anon cannot call calc_prize_pool',
  $q$ select public.calc_prize_pool(1)::text $q$, 'ERROR 42501');
select t.run('functions', 'service', 'register_college (0002) still works; its POC contact is primary',
  $q$ select public.register_college('10000000-0000-0000-0000-000000000001',
       '{"name":"Tara","email":"tara@du.test","phone":"9876543210","year":"2nd year","course":"BA","matiks_username":"tara"}'::jsonb,
       '[]'::jsonb, null, 'Delhi University', 'Delhi', 'Delhi', 'government')::text is not null $q$, 'true / true',
  $c$ select bool_and(is_primary)::text from public.contacts c join public.registrations r on r.id = c.registration_id where r.poc_email = 'tara@du.test' $c$);
select t.run('functions', 'anon', 'anon still cannot call register_college',
  $q$ select public.register_college('10000000-0000-0000-0000-000000000001', '{}'::jsonb)::text $q$, 'ERROR 42501');
