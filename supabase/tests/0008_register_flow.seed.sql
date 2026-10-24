-- Data loaded after 0001–0007 and before 0008 (so 0008's pass_code backfill runs on existing rows).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'poc@iitb.test', '{"name": "Asha Kulkarni"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'invited@iitb.test', '{"name": "Ivan Invited", "phone": "9000000004"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'poc@nitt.test', '{"name": "Neha Iyer"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test', '{"name": "Ravi Kumar", "phone": "9000000006"}');

insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

insert into public.leagues (id, name, slug, season, status) values
  ('10000000-0000-0000-0000-000000000001', 'Matiks College League', 'mcl', 1, 'upcoming');

insert into public.colleges (id, name, city, state, country) values
  ('11000000-0000-0000-0000-000000000001', 'IIT Bombay', 'Mumbai', 'Maharashtra', 'india'),
  ('11000000-0000-0000-0000-000000000002', 'NIT Trichy', 'Tiruchirappalli', 'Tamil Nadu', 'india'),
  ('11000000-0000-0000-0000-000000000003', 'VJTI', 'Mumbai', 'Maharashtra', 'india'),
  ('11000000-0000-0000-0000-000000000004', 'IIT Delhi', 'New Delhi', 'Delhi', 'india');

-- R1 approved (IIT Bombay, 1 contact), R2 pending (NIT Trichy), R3 denied (VJTI). IIT Delhi is unclaimed.
insert into public.registrations (id, league_id, college_id, poc_email, created_by, status, college_email, reviewed_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'poc@iitb.test', '00000000-0000-0000-0000-0000000000a3', 'approved', 'sports@iitb.test', now() - interval '1 hour'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'poc@nitt.test', '00000000-0000-0000-0000-0000000000a5', 'pending', 'sports@nitt.test', null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'old@vjti.test', null, 'rejected', null, now());

insert into public.contacts (id, registration_id, role, name, email, phone) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'poc', 'Asha Kulkarni', 'poc@iitb.test', '9000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'poc', 'Neha Iyer', 'poc@nitt.test', '9000000002');

insert into public.college_access (user_id, registration_id) values
  ('00000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a5', '20000000-0000-0000-0000-000000000002');
