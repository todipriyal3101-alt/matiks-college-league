-- Data loaded after 0001–0004 and before 0005 (so 0005's thread backfill runs on existing registrations).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'poc@iitb.test', '{"name": "Asha"}'),      -- R1 poc_email
  ('00000000-0000-0000-0000-0000000000a4', 'invited@iitb.test', '{}'),               -- college_access on R1
  ('00000000-0000-0000-0000-0000000000a5', 'poc@nitt.test', '{}'),                   -- R2 poc_email
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test', '{"name": "Sam"}'), -- no college yet
  ('00000000-0000-0000-0000-0000000000a7', 'newbie@gmail.test', '{"name": "Nia"}'),   -- self-registers (fixture)
  ('00000000-0000-0000-0000-0000000000a8', 'usa@mit.test', '{}');                     -- R3 (USA) poc_email

insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

insert into public.leagues (id, name, slug, season, registration_open, status)
values ('10000000-0000-0000-0000-000000000001', 'Matiks College League – Season 1', 'mcl-s1', 1, true, 'upcoming');

insert into public.colleges (id, name, city, state) values
  ('11000000-0000-0000-0000-000000000001', 'IIT Bombay', 'Mumbai', 'Maharashtra'),
  ('11000000-0000-0000-0000-000000000002', 'NIT Trichy', 'Tiruchirappalli', 'Tamil Nadu'),
  ('11000000-0000-0000-0000-000000000003', 'MIT', 'Cambridge', 'MA');

insert into public.registrations (id, league_id, college_id, poc_email, status, participant_count) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'POC@iitb.test', 'pending', 250),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'poc@nitt.test', 'approved', 610),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'usa@mit.test', 'approved', 700);

insert into public.college_access (user_id, registration_id, invited_by) values
  ('00000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');

insert into public.contacts (registration_id, role, name, email, phone) values
  ('20000000-0000-0000-0000-000000000001', 'poc', 'Asha', 'poc@iitb.test', '9000000001'),
  ('20000000-0000-0000-0000-000000000002', 'poc', 'Neha', 'poc@nitt.test', '9000000002');

-- R1: W1 pending, W2 paid.  R2: one paid winner.
insert into public.winners (registration_id, position, name, prize_amount, payment_status) values
  ('20000000-0000-0000-0000-000000000001', '1st', 'Kiran', 5000, 'pending'),
  ('20000000-0000-0000-0000-000000000001', '2nd', 'Meera', 3000, 'paid'),
  ('20000000-0000-0000-0000-000000000002', '1st', 'Ravi', 4000, 'paid');
