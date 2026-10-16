-- Data loaded AFTER 0001/0002 and BEFORE 0003, to test 0003's backfill on existing rows.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'poc@iitb.test'),      -- R1 poc_email
  ('00000000-0000-0000-0000-0000000000a4', 'invited@iitb.test'),  -- college_access on R1
  ('00000000-0000-0000-0000-0000000000a5', 'poc@nitt.test'),      -- R2 poc_email
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test');

insert into public.leagues (id, name, slug, season, registration_open, status)
values ('10000000-0000-0000-0000-000000000001', 'Brumble 2.0', 'brumble-2', 2, true, 'upcoming');

insert into public.colleges (id, name, city, state) values
  ('11000000-0000-0000-0000-000000000001', 'IIT Bombay', 'Mumbai', 'Maharashtra'),
  ('11000000-0000-0000-0000-000000000002', 'NIT Trichy', 'Tiruchirappalli', 'Tamil Nadu'),
  ('11000000-0000-0000-0000-000000000003', 'BITS Pilani', 'Pilani', 'Rajasthan');

insert into public.registrations (id, league_id, college_id, poc_email, utm_source) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'POC@iitb.test', 'instagram'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'poc@nitt.test', 'whatsapp'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'nobody@bits.test', null);

-- R1: two 'poc' contacts → the earliest (Asha) must become primary.
-- R2: an earlier 'faculty' contact and a later 'poc' → the poc (Neha) must become primary.
-- R3: no contacts.
insert into public.contacts (id, registration_id, role, name, email, created_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'poc',     'Asha',   'poc@iitb.test',   now() - interval '2 hours'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'poc',     'Ravi',   'ravi@iitb.test',  now() - interval '1 hour'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'faculty', 'Prof X', 'profx@nitt.test', now() - interval '3 hours'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'poc',     'Neha',   'poc@nitt.test',   now() - interval '1 hour');
