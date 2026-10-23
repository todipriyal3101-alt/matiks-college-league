-- Data loaded after 0001–0005 and before 0006.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer@matiks.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a6', 'stranger@gmail.test', '{"name": "Sam"}');

insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Vik Viewer',   'viewer@matiks.test', 'viewer');

-- L1: the live season, registration switch OFF and deadline passed (must no longer matter).
-- L2: a newer season that is already completed (must be skipped).
insert into public.leagues (id, name, slug, season, registration_open, registration_deadline, status) values
  ('10000000-0000-0000-0000-000000000001', 'Matiks College League – Season 1', 'mcl-s1', 1, false, now() - interval '30 days', 'upcoming'),
  ('10000000-0000-0000-0000-000000000002', 'Matiks College League – Season 2', 'mcl-s2', 2, false, null, 'completed');
