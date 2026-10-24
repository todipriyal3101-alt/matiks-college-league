-- Data loaded after 0001–0008 and before 0009 (so 0009's backfills run on existing rows).
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, confirmation_sent_at, invited_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test', '{}', '{}', now(), now(), null),                         -- confirmed by link (old setup)
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test', '{}', '{"providers": ["google"]}', now(), null, null),   -- Google
  ('00000000-0000-0000-0000-0000000000a3', 'POC@iitb.test', '{"name": "Asha Kulkarni"}', '{}', now(), null, null),        -- auto-confirmed: unverified
  ('00000000-0000-0000-0000-0000000000a4', 'invited@iitb.test', '{}', '{}', now(), null, now()),                         -- accepted an invite
  ('00000000-0000-0000-0000-0000000000a5', 'poc@nitt.test', '{}', '{}', null, null, null),
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test', '{}', '{}', now(), null, null);

insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

insert into public.leagues (id, name, slug, season, status) values
  ('10000000-0000-0000-0000-000000000001', 'Matiks College League', 'mcl', 1, 'upcoming');

insert into public.colleges (id, name, state, country) values
  ('11000000-0000-0000-0000-000000000001', 'IIT Bombay', 'Maharashtra', 'india'),
  ('11000000-0000-0000-0000-000000000002', 'NIT Trichy', 'Tamil Nadu', 'india'),
  ('11000000-0000-0000-0000-000000000003', 'VJTI', 'Maharashtra', 'india');

-- R1: reached only through poc_email (backfill must add college_access). R2: an admin-added college whose email has
-- no account (backfill adds a pending entry). R3: denied, email without account (no pending entry).
insert into public.registrations (id, league_id, college_id, poc_email, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'poc@iitb.test', 'approved'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'Lead@NITT.test', 'approved'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'old@vjti.test', 'rejected');

insert into public.college_access (user_id, registration_id) values
  ('00000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-000000000001');
