-- =============================================================
-- Sample data for local development / first setup.
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- =============================================================

insert into public.leagues (name, slug, season, start_date, end_date, registration_deadline, registration_open, max_colleges, status)
values ('Brumble 2.0', 'brumble-2', 2, '2026-12-01', '2027-02-28', '2026-11-30 23:59:00+05:30', true, 200, 'upcoming')
on conflict (slug) do nothing;

insert into public.colleges (name, short_name, city, state, college_type) values
  ('Indian Institute of Technology Bombay',     'IIT Bombay',    'Mumbai',      'Maharashtra',   'iit'),
  ('Indian Institute of Technology Delhi',      'IIT Delhi',     'New Delhi',   'Delhi',         'iit'),
  ('Indian Institute of Technology Kharagpur',  'IIT Kharagpur', 'Kharagpur',   'West Bengal',   'iit'),
  ('Indian Institute of Technology Madras',     'IIT Madras',    'Chennai',     'Tamil Nadu',    'iit'),
  ('Indian Institute of Technology Kanpur',     'IIT Kanpur',    'Kanpur',      'Uttar Pradesh', 'iit'),
  ('National Institute of Technology Rourkela', 'NIT Rourkela',  'Rourkela',    'Odisha',        'nit'),
  ('National Institute of Technology Trichy',   'NIT Trichy',    'Tiruchirappalli', 'Tamil Nadu', 'nit'),
  ('BITS Pilani',                               'BITS Pilani',   'Pilani',      'Rajasthan',     'bits'),
  ('IIIT Hyderabad',                            'IIIT-H',        'Hyderabad',   'Telangana',     'iiit'),
  ('Delhi Technological University',            'DTU',           'New Delhi',   'Delhi',         'government')
on conflict (normalized_name) do nothing;

-- -------------------------------------------------------------
-- FIRST ADMIN (run once, manually, after you sign up at /admin/login
-- or create the user in Supabase Dashboard > Authentication > Users):
--
-- insert into public.admin_profiles (user_id, name, email, role)
-- select id, 'Prachi', email, 'admin' from auth.users where email = 'social@matiks.com';
-- -------------------------------------------------------------
