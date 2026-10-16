-- Data loaded after 0001–0003 and before 0004.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matiks.test');
insert into public.admin_profiles (user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ananya Admin', 'admin@matiks.test', 'admin');

insert into public.leagues (id, name, slug, season, status, registration_open) values
  ('10000000-0000-0000-0000-000000000001', 'Matiks College League – Season 1', 'mcl-s1', 1, 'upcoming', true),
  ('10000000-0000-0000-0000-000000000009', 'Draft Season', 'draft-s', 9, 'draft', false);

insert into public.colleges (id, name, short_name, city, state, website, college_type) values
  -- Pair 1: clean merge (keep has no city/website; duplicate has them)
  ('11000000-0000-0000-0000-0000000000a1', 'IIT Bombay', 'IITB', null, null, null, 'other'),
  ('11000000-0000-0000-0000-0000000000d1', 'Indian Institute of Technology Bombay', null, 'Mumbai', 'Maharashtra', 'https://iitb.ac.in', 'iit'),
  -- Pair 2: both registered in Season 1
  ('11000000-0000-0000-0000-0000000000a2', 'NIT Trichy', null, 'Tiruchirappalli', 'Tamil Nadu', null, 'nit'),
  ('11000000-0000-0000-0000-0000000000d2', 'National Institute of Technology Tiruchirappalli', null, 'Tiruchirappalli', 'Tamil Nadu', null, 'nit'),
  -- Pair 3: played each other
  ('11000000-0000-0000-0000-0000000000a3', 'BITS Pilani', null, 'Pilani', 'Rajasthan', null, 'bits'),
  ('11000000-0000-0000-0000-0000000000d3', 'Birla Institute Pilani', null, 'Pilani', 'Rajasthan', null, 'bits'),
  -- Opponent
  ('11000000-0000-0000-0000-0000000000c9', 'Anna University', null, 'Chennai', 'Tamil Nadu', null, 'government');

insert into public.registrations (id, league_id, college_id, poc_email, status) values
  ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-0000000000d1', 'p1@x.test', 'approved'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-0000000000a2', 'p2@x.test', 'pending'),
  ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-0000000000d2', 'p3@x.test', 'rejected'),
  ('20000000-0000-0000-0000-0000000000c9', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-0000000000c9', 'p4@x.test', 'approved'),
  -- Approved, but in a draft season: must not appear on the public wall.
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-000000000009', '11000000-0000-0000-0000-0000000000a3', 'p5@x.test', 'approved');

insert into public.matches (league_id, round, college_a_id, college_b_id, score_a, score_b, winner_id) values
  ('10000000-0000-0000-0000-000000000001', 'Group A', '11000000-0000-0000-0000-0000000000d1', '11000000-0000-0000-0000-0000000000c9', 42, 30, '11000000-0000-0000-0000-0000000000d1'),
  ('10000000-0000-0000-0000-000000000001', 'Group B', '11000000-0000-0000-0000-0000000000a3', '11000000-0000-0000-0000-0000000000d3', null, null, null);

insert into public.ambassadors (name, college_id, referral_code) values
  ('Riya', '11000000-0000-0000-0000-0000000000d1', 'RIYA101');
