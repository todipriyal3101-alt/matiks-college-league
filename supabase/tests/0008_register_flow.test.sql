-- =============================================================
-- Tests for 0008_register_flow.sql (scripts/db-test.sh). Each t.run is rolled back.
-- Personas: poc = IIT Bombay (approved), other = NIT Trichy (pending), stranger/invited = no college yet.
-- =============================================================

grant usage on schema t to anon, authenticated;

-- Multi-step helpers (a CTE can't see its own inserts).
create function t.verify(p_email text, p_hash text, p_tries text[]) returns text language plpgsql as $$
declare v text; x text; out text := '';
begin
  perform public.start_email_verification(p_email, p_hash);
  foreach x in array p_tries loop
    v := public.check_email_verification(p_email, x);
    out := out || v || ',';
  end loop;
  return rtrim(out, ',');
end $$;
create function t.join_then(p_accept boolean) returns text language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.join_requests where status = 'pending' limit 1;
  perform public.decide_join_request(v_id, p_accept);
  return (select status from public.join_requests where id = v_id);
end $$;
create function t.request_twice() returns text language plpgsql as $$
begin
  perform public.request_to_join('20000000-0000-0000-0000-000000000002');
  perform public.request_to_join('20000000-0000-0000-0000-000000000001');
  return (select string_agg(status || '@' || right(registration_id::text, 1), ',' order by created_at)
          from public.join_requests where user_id = auth.uid());
end $$;
create function t.squad_count() returns text language plpgsql as $$
begin
  return (select count(*)::text from public.my_squad_invites('20000000-0000-0000-0000-000000000001'));
end $$;
create function t.first_code() returns text language sql security definer as $$
  select code from public.squad_invites where registration_id = '20000000-0000-0000-0000-000000000001' and used_at is null and revoked_at is null order by created_at limit 1;
$$;
create function t.pass_code(p_id uuid) returns text language sql security definer as $$
  select pass_code from public.registrations where id = p_id;
$$;
create function t.any_code() returns text language sql security definer as $$
  select code from public.squad_invites order by created_at limit 1;
$$;
grant execute on all functions in schema t to anon, authenticated;

-- ---------- Registrations: new columns ----------
select t.run('cols', 'postgres', 'pass codes backfilled, distinct, 12 chars',
  $q$ select (bool_and(pass_code ~ '^[a-z0-9]{12}$') and count(distinct pass_code) = count(*))::text from public.registrations $q$, 'true');
select t.run('cols', 'other', 'POC sets target_players while pending',
  $q$ with x as (update public.registrations set target_players = 420 where id = '20000000-0000-0000-0000-000000000002' returning target_players) select * from x $q$, '420');
select t.run('cols', 'other', 'target_players must be 50–1000',
  $q$ with x as (update public.registrations set target_players = 20 where id = '20000000-0000-0000-0000-000000000002' returning 1) select count(*)::text from x $q$, 'ERROR 23514');
select t.run('cols', 'poc', 'approved: target_players is locked for the POC',
  $q$ with x as (update public.registrations set target_players = 900 where id = '20000000-0000-0000-0000-000000000001' returning target_players) select coalesce(x.target_players::text, 'null') from x $q$, 'null');
select t.run('cols', 'other', 'POC cannot set verified / first viewed / pass code',
  $q$ with x as (update public.registrations set email_verified_at = now(), admin_first_viewed_at = now(), pass_code = 'aaaaaaaaaaaa'
       where id = '20000000-0000-0000-0000-000000000002' returning (email_verified_at is null and admin_first_viewed_at is null and pass_code <> 'aaaaaaaaaaaa')::text) select * from x $q$, 'true');
select t.run('cols', 'admin', 'admin writers can set them',
  $q$ with x as (update public.registrations set email_verified_at = now() where id = '20000000-0000-0000-0000-000000000002' returning (email_verified_at is not null)::text) select * from x $q$, 'true');

-- ---------- Under review ----------
select t.run('viewed', 'viewer', 'any admin opening it stamps admin_first_viewed_at',
  $q$ select public.mark_registration_viewed('20000000-0000-0000-0000-000000000002')::text $q$, ' / true',
  $c$ select (admin_first_viewed_at is not null)::text from public.registrations where id = '20000000-0000-0000-0000-000000000002' $c$);
select t.run('viewed', 'other', 'the POC opening it does not',
  $q$ select public.mark_registration_viewed('20000000-0000-0000-0000-000000000002')::text $q$, ' / false',
  $c$ select (admin_first_viewed_at is not null)::text from public.registrations where id = '20000000-0000-0000-0000-000000000002' $c$);
select t.run('viewed', 'anon', 'anon cannot call it',
  $q$ select public.mark_registration_viewed('20000000-0000-0000-0000-000000000002')::text $q$, 'ERROR 42501');

-- ---------- Drafts ----------
select t.run('drafts', 'stranger', 'save own draft',
  $q$ with x as (insert into public.registration_drafts (user_id, data) values (auth.uid(), '{"step": 2}') returning data->>'step') select * from x $q$, '2');
insert into public.registration_drafts (user_id, data) values ('00000000-0000-0000-0000-0000000000a6', '{"step": 3}');
select t.run('drafts', 'invited', 'cannot read someone else''s draft',
  $q$ select count(*)::text from public.registration_drafts $q$, '0');
select t.run('drafts', 'invited', 'cannot write someone else''s draft',
  $q$ with x as (insert into public.registration_drafts (user_id, data) values ('00000000-0000-0000-0000-0000000000a6', '{}') returning 1) select count(*)::text from x $q$, 'ERROR 42501');
select t.run('drafts', 'anon', 'anon cannot read drafts',
  $q$ select count(*)::text from public.registration_drafts $q$, 'ERROR 42501');
select t.run('drafts', 'stranger', 'drafts are size-limited',
  $q$ with x as (update public.registration_drafts set data = jsonb_build_object('x', repeat('a', 20000)) where user_id = auth.uid() returning 1) select count(*)::text from x $q$, 'ERROR 23514');
delete from public.registration_drafts;

-- ---------- Email verification ----------
select t.run('verify', 'stranger', 'right code → ok, and my_email_verified',
  $q$ select t.verify('Sports@IITD.test', repeat('a', 64), array[repeat('a', 64)]) $q$, 'ok / true',
  $c$ select (verified_at is not null)::text from public.email_verifications where email = 'sports@iitd.test' $c$);
select t.run('verify', 'stranger', 'wrong codes count down, then lock after 5',
  $q$ select t.verify('sports@iitd.test', repeat('a', 64), array[repeat('b', 64), repeat('b', 64), repeat('b', 64), repeat('b', 64), repeat('b', 64), repeat('a', 64)]) $q$,
  'wrong:4,wrong:3,wrong:2,wrong:1,locked,locked');
select t.run('verify', 'stranger', 'a second code within 45 s is refused',
  $q$ select public.start_email_verification('a@iitd.test', repeat('a', 64))::text || public.start_email_verification('a@iitd.test', repeat('a', 64))::text $q$,
  'ERROR P0001: Wait a moment');
insert into public.email_verifications (user_id, email, code_hash, expires_at, created_at)
  select '00000000-0000-0000-0000-0000000000a4', 'x@iitd.test', repeat('a', 64), now() - interval '1 minute', now() - interval '2 hours' ;
select t.run('verify', 'invited', 'an expired code says expired',
  $q$ select public.check_email_verification('x@iitd.test', repeat('a', 64)) $q$, 'expired');
insert into public.email_verifications (user_id, email, code_hash, expires_at, created_at)
  select '00000000-0000-0000-0000-0000000000a4', 'y' || g || '@iitd.test', repeat('a', 64), now(), now() - interval '50 minutes' + g * interval '1 minute' from generate_series(1, 5) g;
select t.run('verify', 'invited', 'max 5 codes an hour',
  $q$ select public.start_email_verification('z@iitd.test', repeat('a', 64))::text $q$, 'ERROR P0001: Too many codes');
delete from public.email_verifications;
select t.run('verify', 'stranger', 'users cannot read the codes table',
  $q$ select count(*)::text from public.email_verifications $q$, 'ERROR 42501');
select t.run('verify', 'other', 'verifying the registration''s college email marks it Verified',
  $q$ select t.verify('sports@nitt.test', repeat('c', 64), array[repeat('c', 64)]) $q$, 'ok / true',
  $c$ select (email_verified_at is not null)::text from public.registrations where id = '20000000-0000-0000-0000-000000000002' $c$);
insert into public.email_verifications (user_id, email, code_hash, expires_at, verified_at)
  values ('00000000-0000-0000-0000-0000000000a5', 'sports@nitt.test', repeat('c', 64), now(), now());
update public.registrations set email_verified_at = now() where id = '20000000-0000-0000-0000-000000000002';
select t.run('verify', 'other', 'changing the college email clears Verified',
  $q$ with x as (update public.registrations set college_email = 'new@nitt.test' where id = '20000000-0000-0000-0000-000000000002' returning (email_verified_at is null)::text) select * from x $q$, 'true');
create function t.new_reg_verified(p_email text) returns text language plpgsql as $$
declare v_id uuid;
begin
  insert into public.email_verifications (user_id, email, code_hash, expires_at, verified_at)
    values ('00000000-0000-0000-0000-0000000000a6', 'sports@iitd.test', repeat('a', 64), now(), now());
  insert into public.registrations (league_id, college_id, poc_email, created_by, college_email)
    values ('10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 'stranger@gmail.test', '00000000-0000-0000-0000-0000000000a6', p_email)
    returning id into v_id;
  return (select (email_verified_at is not null)::text from public.registrations where id = v_id);
end $$;
select t.run('verify', 'postgres', 'a new registration with a verified college email starts Verified',
  $q$ select t.new_reg_verified('sports@iitd.test') $q$, 'true');
select t.run('verify', 'postgres', 'with another email it does not',
  $q$ select t.new_reg_verified('other@iitd.test') $q$, 'false');
delete from public.email_verifications;

-- ---------- Claim screen ----------
select t.run('claim', 'stranger', 'claimed colleges show first name + last initial; unclaimed and denied are absent',
  $q$ select string_agg(right(college_id::text, 1) || ':' || claimed_by || ':' || status, ',' order by college_id)
      from public.college_claim_status(array['11000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002',
                                             '11000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000004']::uuid[]) $q$,
  '1:Asha K.:approved,2:Neha I.:pending');
select t.run('claim', 'anon', 'anon cannot see claims',
  $q$ select count(*)::text from public.college_claim_status(array['11000000-0000-0000-0000-000000000001']::uuid[]) $q$, 'ERROR 42501');

-- ---------- Join requests ----------
select t.run('join', 'stranger', 'ask to join a claimed college → POCs get a notification',
  $q$ select (public.request_to_join('20000000-0000-0000-0000-000000000001') is not null)::text $q$, 'true / Ravi K. wants to join your team',
  $c$ select title from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'team' $c$);
select t.run('join', 'poc', 'someone with a college can''t ask to join another',
  $q$ select public.request_to_join('20000000-0000-0000-0000-000000000002')::text $q$, 'ERROR P0001: You already have a college registration');
select t.run('join', 'stranger', 'denied registrations take no requests',
  $q$ select public.request_to_join('20000000-0000-0000-0000-000000000003')::text $q$, 'ERROR P0001: That team isn');
select t.run('join', 'stranger', 'one pending request at a time (asking again replaces it)',
  $q$ select t.request_twice() $q$, 'cancelled@2,pending@1');
select t.run('join', 'admin', 'admins can''t ask to join',
  $q$ select public.request_to_join('20000000-0000-0000-0000-000000000001')::text $q$, 'ERROR P0001: Matiks admins');

-- A pending request from the stranger to IIT Bombay for the decide tests.
insert into public.join_requests (registration_id, user_id, name, email, phone)
  values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a6', 'Ravi Kumar', 'stranger@gmail.test', '9000000006');
select t.run('join', 'poc', 'accept → access + contact + notification to the requester',
  $q$ select t.join_then(true) $q$, 'accepted / 1|2|You''re on the IIT Bombay team',
  $c$ select (select count(*) from public.college_access where user_id = '00000000-0000-0000-0000-0000000000a6')::text || '|' ||
             (select count(*) from public.contacts where registration_id = '20000000-0000-0000-0000-000000000001')::text || '|' ||
             (select title from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a6') $c$);
select t.run('join', 'poc', 'decline → no access',
  $q$ select t.join_then(false) $q$, 'declined / 0',
  $c$ select count(*)::text from public.college_access where user_id = '00000000-0000-0000-0000-0000000000a6' $c$);
select t.run('join', 'other', 'another college''s POC can''t answer it',
  $q$ select t.join_then(true) $q$, 'ERROR P0001: Request not found');
select t.run('join', 'other', 'and can''t see it',
  $q$ select count(*)::text from public.join_requests $q$, '0');
select t.run('join', 'stranger', 'the requester sees their own request',
  $q$ select count(*)::text from public.join_requests $q$, '1');
select t.run('join', 'stranger', 'requests can''t be written directly',
  $q$ with x as (update public.join_requests set status = 'accepted' returning 1) select count(*)::text from x $q$, 'ERROR 42501');
insert into public.contacts (registration_id, role, name, email) values
  ('20000000-0000-0000-0000-000000000001', 'poc', 'Two', 'two@iitb.test'),
  ('20000000-0000-0000-0000-000000000001', 'poc', 'Three', 'three@iitb.test');
select t.run('join', 'poc', 'a full team (3 contacts) can''t accept more',
  $q$ select t.join_then(true) $q$, 'ERROR P0001: This team already has 3 people');
delete from public.contacts where email in ('two@iitb.test', 'three@iitb.test');
delete from public.join_requests;

-- ---------- Squad invites ----------
select t.run('squad', 'poc', 'one link per free spot (3 − 1 contact = 2)',
  $q$ select t.squad_count() $q$, '2');
select t.run('squad', 'stranger', 'strangers can''t list a team''s links',
  $q$ select count(*)::text from public.my_squad_invites('20000000-0000-0000-0000-000000000001') $q$, 'ERROR 42501');
select set_config('request.jwt.claims', t.claims('poc'), false);
select count(*) from public.my_squad_invites('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims', '', false);
select t.run('squad', 'anon', 'the /j page shows the college and that the link is open',
  $q$ select college_name || '|' || open from public.squad_invite_info(t.first_code()) $q$, 'IIT Bombay|true');
select t.run('squad', 'invited', 'redeeming joins the team (access + contact; POCs notified)',
  $q$ select right(public.redeem_squad_invite(t.first_code())::text, 1) $q$, '1 / 1|2|Ivan I. joined your team',
  $c$ select (select count(*) from public.college_access where user_id = '00000000-0000-0000-0000-0000000000a4')::text || '|' ||
             (select count(*) from public.contacts where registration_id = '20000000-0000-0000-0000-000000000001')::text || '|' ||
             (select title from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a3' order by created_at desc limit 1) $c$);
select t.run('squad', 'other', 'someone with a college can''t redeem',
  $q$ select public.redeem_squad_invite(t.first_code())::text $q$, 'ERROR P0001: You already have a college registration');
select t.run('squad', 'invited', 'an unknown code has expired',
  $q$ select public.redeem_squad_invite('zzzzzzzzzzzz')::text $q$, 'ERROR P0001: This invite link has expired');
select t.run('squad', 'anon', 'anon can''t read the table',
  $q$ select count(*)::text from public.squad_invites $q$, 'ERROR 42501');
select t.run('squad', 'anon', 'anon can''t redeem',
  $q$ select public.redeem_squad_invite('zzzzzzzzzzzz')::text $q$, 'ERROR 42501');
insert into public.contacts (registration_id, role, name, email) values
  ('20000000-0000-0000-0000-000000000001', 'poc', 'Two', 'two@iitb.test'),
  ('20000000-0000-0000-0000-000000000001', 'poc', 'Three', 'three@iitb.test');
select t.run('squad', 'poc', 'a full team has no open links (old ones withdrawn)',
  $q$ select t.squad_count() $q$, '0');
select t.run('squad', 'anon', 'and the /j page says closed',
  $q$ select coalesce(min(open::text), 'none') from public.squad_invite_info(t.any_code()) $q$, 'false');
delete from public.contacts where email in ('two@iitb.test', 'three@iitb.test');

-- ---------- Public ----------
select t.run('public', 'anon', 'ticker: approved by college name, new registrations by state only',
  $q$ select string_agg(kind || ':' || label, ',' order by kind, label) from public.public_activity_feed(12) $q$,
  'approved:IIT Bombay,registered:Maharashtra,registered:Tamil Nadu');
select t.run('public', 'anon', 'rivalry counts approved colleges in a state (any case)',
  $q$ select public.public_state_rivalry('maharashtra')::text || ',' || public.public_state_rivalry('Tamil Nadu')::text $q$, '1,0');
select t.run('public', 'anon', 'early bird: 10 − approved this season',
  $q$ select public.public_early_bird_left()::text $q$, '9');
select t.run('public', 'anon', 'pass of a pending college: name + status, no slug',
  $q$ select college_name || '|' || status || '|' || coalesce(slug, '-') from public.public_pass(t.pass_code('20000000-0000-0000-0000-000000000002')) $q$,
  'NIT Trichy|pending|-');
select t.run('public', 'anon', 'pass of an approved college links its page',
  $q$ select slug from public.public_pass(t.pass_code('20000000-0000-0000-0000-000000000001')) $q$, 'iit-bombay');
select t.run('public', 'anon', 'a denied college''s pass shows nothing',
  $q$ select count(*)::text from public.public_pass(t.pass_code('20000000-0000-0000-0000-000000000003')) $q$, '0');
select t.run('public', 'anon', 'anon can''t read join requests',
  $q$ select count(*)::text from public.join_requests $q$, 'ERROR 42501');
select t.run('public', 'anon', 'internal helpers are not callable',
  $q$ select public.user_has_registration('00000000-0000-0000-0000-0000000000a3')::text $q$, 'ERROR 42501');
select t.run('public', 'stranger', 'nor by signed-in users',
  $q$ select public.add_team_member('20000000-0000-0000-0000-000000000001', auth.uid(), null)::text $q$, 'ERROR 42501');

-- ---------- Admin view ----------
select t.run('view', 'admin', 'registration_overview has the new columns',
  $q$ select count(*)::text from public.registration_overview where pass_code is not null and reviewed_at is not null $q$, '2');
select t.run('view', 'stranger', 'and still shows nothing to strangers',
  $q$ select count(*)::text from public.registration_overview $q$, '0');
