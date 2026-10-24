-- Data loaded after 0001–0006 and before 0007 (so 0007's slug/certificate/badge backfills run on existing rows).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'poc@iitb.test', '{"name": "Asha Kulkarni"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'poc@nitt.test', '{"name": "Neha"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test', '{}');

insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

insert into public.leagues (id, name, slug, season, status) values
  ('10000000-0000-0000-0000-000000000001', 'Matiks College League – Season 1', 'mcl-s1', 1, 'upcoming');

insert into public.colleges (id, name, city, state, country) values
  ('11000000-0000-0000-0000-000000000001', 'IIT Bombay', 'Mumbai', 'Maharashtra', 'india'),
  ('11000000-0000-0000-0000-000000000002', 'NIT Trichy', 'Tiruchirappalli', 'Tamil Nadu', 'india'),
  ('11000000-0000-0000-0000-000000000003', 'MIT', 'Cambridge', 'Massachusetts', 'usa'),
  ('11000000-0000-0000-0000-000000000004', 'IIT Delhi', 'New Delhi', 'Delhi', 'india');

-- R1 approved (250 players, 1 contact), R2 pending, R3 approved USA.
insert into public.registrations (id, league_id, college_id, poc_email, status, participant_count, league_start, league_end) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'poc@iitb.test', 'approved', 250, current_date + 3, current_date + 10),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'poc@nitt.test', 'pending', 0, null, null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'usa@mit.test', 'approved', 700, null, null);

insert into public.contacts (id, registration_id, role, name, email, phone) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'poc', 'Asha Kulkarni', 'poc@iitb.test', '9000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'poc', 'Neha Iyer', 'poc@nitt.test', '9000000002'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'poc', 'Mia Chen', 'usa@mit.test', '+15550000003');
