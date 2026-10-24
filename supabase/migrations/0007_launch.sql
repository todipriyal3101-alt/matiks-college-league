-- =============================================================
-- 0007 — LinkedIn launch: duel rounds, invite links + attribution, Campus Lead certificates, badges,
-- college slugs, and the public read functions behind the home page, college race, college pages,
-- invite previews and certificate verify pages.
--
-- Public data only: anon gets EXECUTE on the public_* / top_duels_today functions (public columns only:
-- never POC emails, phones or full names) and nothing else. Duel rounds are written only by the server
-- (service role) after it has verified a signed round.
-- =============================================================

-- ---------- College slugs (/c/[slug]) ----------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), ''), 'college');
$$;

alter table public.colleges add column slug text;

-- Backfill, de-duplicated with -2, -3 … in creation order.
with ranked as (
  select id, public.slugify(name) as base,
         row_number() over (partition by public.slugify(name) order by created_at, id) as n
  from public.colleges
)
update public.colleges c
set slug = case when r.n = 1 then r.base else r.base || '-' || r.n end
from ranked r
where r.id = c.id;

alter table public.colleges
  alter column slug set not null,
  add constraint colleges_slug_key unique (slug),
  add constraint colleges_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Set once (stable public URL: renaming a college doesn't break links already shared); admins may change it.
create or replace function public.colleges_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_n    int := 1;
begin
  if tg_op = 'UPDATE' and new.slug is null then
    new.slug := old.slug;
  end if;
  if new.slug is not null then
    return new;
  end if;
  v_base := public.slugify(new.name);
  v_slug := v_base;
  while exists (select 1 from public.colleges c where c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  new.slug := v_slug;
  return new;
end;
$$;

create trigger colleges_set_slug
  before insert or update of slug on public.colleges
  for each row execute function public.colleges_set_slug();

-- ---------- Notifications: badge kind ----------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('registration', 'review', 'announcement', 'badge'));

-- ---------- Invite codes (/i/CODE) ----------
-- Opaque random codes (no names in the URL). POC codes: one per POC login per registration.
-- Player codes: made by the server for a verified duel round ("Challenge a friend").
create table public.invite_codes (
  code             text primary key,
  kind             text not null,
  user_id          uuid references auth.users(id) on delete cascade,
  registration_id  uuid references public.registrations(id) on delete cascade,
  display_name     text,             -- first name only
  college_id       uuid references public.colleges(id) on delete set null,
  score            int,              -- player codes: the score to beat
  created_at       timestamptz not null default now(),
  constraint invite_codes_code_check check (code ~ '^[a-z0-9]{10}$'),
  constraint invite_codes_kind_check check (kind in ('poc', 'player')),
  constraint invite_codes_poc_check check (kind <> 'poc' or (user_id is not null and registration_id is not null)),
  constraint invite_codes_name_check check (display_name is null or length(display_name) between 1 and 24),
  constraint invite_codes_score_check check (score is null or score between 0 and 200)
);

create unique index invite_codes_one_per_poc on public.invite_codes (user_id, registration_id) where kind = 'poc';
create index invite_codes_registration_idx on public.invite_codes (registration_id);

-- 40 random bits from gen_random_uuid() (cryptographically random), lowercase hex.
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(md5(gen_random_uuid()::text), 1, 10);
$$;

-- Registrations remember the invite link that brought them (set by the server only).
alter table public.registrations
  add column invite_code text references public.invite_codes(code) on delete set null;

create index registrations_invite_code_idx on public.registrations (invite_code);

-- invite_code joins the admin-only fields (replaces the 0005 version; everything else unchanged).
create or replace function public.protect_registration_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin_writer() then
    if coalesce(current_setting('app.review_bypass', true), '') <> 'on' then
      new.status      := old.status;
      new.deny_reason := old.deny_reason;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
    new.admin_notes         := old.admin_notes;
    new.league_id           := old.league_id;
    new.college_id          := old.college_id;
    new.poc_email           := old.poc_email;
    new.referral_code       := old.referral_code;
    new.utm_source          := old.utm_source;
    new.utm_medium          := old.utm_medium;
    new.utm_campaign        := old.utm_campaign;
    new.utm_content         := old.utm_content;
    new.stage               := old.stage;
    new.stage_override      := old.stage_override;
    new.participant_count   := old.participant_count;
    new.prize_pool_override := old.prize_pool_override;
    new.created_by          := old.created_by;
    new.invite_code         := old.invite_code;
    if old.status not in ('pending', 'rejected') then
      new.college_email      := old.college_email;
      new.email_domain       := old.email_domain;
      new.college_logo_url   := old.college_logo_url;
      new.club_name          := old.club_name;
      new.club_logo_url      := old.club_logo_url;
      new.registration_start := old.registration_start;
      new.league_start       := old.league_start;
      new.league_end         := old.league_end;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- Duel rounds ----------
-- Issued by the server (seed + expiry, signed with DUEL_SECRET), verified and scored by the server, written with
-- the service role only. ip_hash is a salted hash, never the IP itself.
create table public.duel_rounds (
  id            uuid primary key default gen_random_uuid(),
  seed          bigint not null,
  ip_hash       text not null,
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz not null,
  submitted_at  timestamptz,
  score         int,
  correct       int,
  attempted     int,
  best_combo    int,
  player_name   text,               -- first name only, optional
  college_id    uuid references public.colleges(id) on delete set null,
  invite_code   text references public.invite_codes(code) on delete set null,   -- came via someone's link
  hidden        boolean not null default false,                                  -- admins hide entries
  constraint duel_rounds_score_check check (score is null or score between 0 and 200),
  constraint duel_rounds_name_check check (player_name is null or length(player_name) between 1 and 24)
);

create index duel_rounds_ip_idx on public.duel_rounds (ip_hash, issued_at desc);
create index duel_rounds_board_idx on public.duel_rounds (submitted_at desc) where submitted_at is not null;
create index duel_rounds_invite_idx on public.duel_rounds (invite_code) where invite_code is not null;

-- ---------- Campus Lead certificates ----------
-- One per contact of an approved registration. Public id: MCL-XXXX-XXXX-XXXX (48 random bits).
create or replace function public.new_certificate_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'MCL-' || upper(substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4))
  from (select md5(gen_random_uuid()::text) as h) x;
$$;

create table public.certificates (
  id               text primary key default public.new_certificate_id(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  contact_id       uuid not null unique references public.contacts(id) on delete cascade,
  recipient_name   text not null,
  issued_at        timestamptz not null default now(),
  hidden           boolean not null default false,   -- "Hide my certificate": verify page says "not available"
  updated_at       timestamptz not null default now(),
  constraint certificates_id_check check (id ~ '^MCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$')
);

create index certificates_registration_idx on public.certificates (registration_id);

create trigger certificates_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();

-- POCs may only flip `hidden` (column grant below); everything else is kept. Depth 1 = a direct update by the user;
-- the database's own sync (contact renamed → contacts_sync_certificates) runs deeper and is let through.
create or replace function public.certificates_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_non_admin_user() and pg_trigger_depth() = 1 then
    new.id := old.id;
    new.registration_id := old.registration_id;
    new.contact_id := old.contact_id;
    new.recipient_name := old.recipient_name;
    new.issued_at := old.issued_at;
  end if;
  return new;
end;
$$;

create trigger certificates_protect before update on public.certificates
  for each row execute function public.certificates_protect();

-- Approval issues them; leaving "approved" withdraws them (Undo included).
create or replace function public.registrations_sync_certificates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.certificates (registration_id, contact_id, recipient_name)
    select new.id, c.id, c.name from public.contacts c where c.registration_id = new.id
    on conflict (contact_id) do nothing;
  elsif old.status = 'approved' and new.status <> 'approved' then
    delete from public.certificates where registration_id = new.id;
  end if;
  return null;
end;
$$;

create trigger registrations_sync_certificates
  after update of status on public.registrations
  for each row execute function public.registrations_sync_certificates();

-- Contacts added later get one too; renames follow.
create or replace function public.contacts_sync_certificates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.registrations r where r.id = new.registration_id and r.status = 'approved') then
      insert into public.certificates (registration_id, contact_id, recipient_name)
      values (new.registration_id, new.id, new.name)
      on conflict (contact_id) do nothing;
    end if;
  elsif new.name is distinct from old.name then
    update public.certificates set recipient_name = new.name where contact_id = new.id;
  end if;
  return null;
end;
$$;

create trigger contacts_sync_certificates
  after insert or update of name on public.contacts
  for each row execute function public.contacts_sync_certificates();

-- ---------- Badges ----------
create table public.badges (
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  badge            text not null,
  earned_at        timestamptz not null default now(),
  primary key (registration_id, badge),
  constraint badges_badge_check check (badge in ('early_bird', 'full_squad', 'club_200', 'club_400', 'club_600', 'recruiter', 'champion'))
);

-- People who came through a registration's POC invite links: submitted duel plays + registrations.
create or replace function public.invite_count(p_registration_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.duel_rounds d join public.invite_codes i on i.code = d.invite_code
      where i.registration_id = p_registration_id and i.kind = 'poc' and d.submitted_at is not null)
    + (select count(*) from public.registrations r join public.invite_codes i on i.code = r.invite_code
      where i.registration_id = p_registration_id and i.kind = 'poc')
  )::int;
$$;

-- Awards whatever the registration now qualifies for (badges are kept once earned) and notifies its POCs.
-- Returns the newly earned badges.
create or replace function public.refresh_badges(p_registration_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.registrations;
  v_country  public.country;
  v_total    int;
  v_paid     int;
  v_contacts int;
  v_earlier  int;
  v_want     text[] := '{}';
  v_new      text[];
  v_labels   jsonb := '{"early_bird":"Early bird","full_squad":"Full squad","club_200":"200 club","club_400":"400 club","club_600":"600 club","recruiter":"Recruiter","champion":"Champion"}';
begin
  select * into r from public.registrations where id = p_registration_id;
  if r.id is null or r.status <> 'approved' then
    return '{}';
  end if;
  select c.country into v_country from public.colleges c where c.id = r.college_id;
  select count(*), count(*) filter (where payment_status = 'paid') into v_total, v_paid from public.winners where registration_id = r.id;
  select count(*) into v_contacts from public.contacts where registration_id = r.id;
  select count(*) into v_earlier from public.registrations x
  where x.league_id = r.league_id and x.status = 'approved' and (x.created_at, x.id) < (r.created_at, r.id);

  if v_earlier < 10 then v_want := array_append(v_want, 'early_bird'); end if;
  if v_contacts >= 3 then v_want := array_append(v_want, 'full_squad'); end if;
  if r.participant_count >= 200 then v_want := array_append(v_want, 'club_200'); end if;
  if r.participant_count >= 400 then v_want := array_append(v_want, 'club_400'); end if;
  if r.participant_count >= 600 then v_want := array_append(v_want, 'club_600'); end if;
  if public.invite_count(r.id) >= 5 then v_want := array_append(v_want, 'recruiter'); end if;
  if public.derive_stage(r.stage_override, r.stage, v_country, r.league_start, r.league_end, v_total, v_paid) = 'ended_prize_sent' then
    v_want := array_append(v_want, 'champion');
  end if;

  with ins as (
    insert into public.badges (registration_id, badge)
    select r.id, b from unnest(v_want) b
    on conflict do nothing
    returning badge
  )
  select coalesce(array_agg(badge), '{}') into v_new from ins;

  if array_length(v_new, 1) > 0 then
    insert into public.notifications (user_id, kind, title, body, link, registration_id)
    select p.user_id, 'badge',
           'Badge earned: ' || (v_labels ->> b),
           'Your college just earned the ' || (v_labels ->> b) || ' badge. See it in your college portal.',
           '/college', r.id
    from public.registration_poc_users(r.id) p, unnest(v_new) b;
  end if;
  return v_new;
end;
$$;

-- What the POC panel calls on open (time-based badges like Champion), for its own registration only.
create or replace function public.refresh_my_badges(p_registration_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_registration_poc(p_registration_id) or public.is_admin()) then
    raise exception 'Not your registration.' using errcode = '42501';
  end if;
  return public.refresh_badges(p_registration_id);
end;
$$;

-- Keep badges current as the data changes.
create or replace function public.badges_after_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_badges(new.id);
  -- A registration that came through an invite link counts for the inviter's college.
  if new.invite_code is not null and (tg_op = 'INSERT' or new.invite_code is distinct from old.invite_code) then
    perform public.refresh_badges(i.registration_id) from public.invite_codes i where i.code = new.invite_code and i.kind = 'poc';
  end if;
  return null;
end;
$$;

create trigger registrations_badges
  after insert or update of status, participant_count, stage_override, league_start, league_end, invite_code on public.registrations
  for each row execute function public.badges_after_registration();

create or replace function public.badges_after_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_badges(coalesce(new.registration_id, old.registration_id));
  return null;
end;
$$;

create trigger contacts_badges after insert on public.contacts
  for each row execute function public.badges_after_child();
create trigger winners_badges after insert or update of payment_status on public.winners
  for each row execute function public.badges_after_child();

create or replace function public.badges_after_duel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invite_code is not null and new.submitted_at is not null and old.submitted_at is null then
    perform public.refresh_badges(i.registration_id) from public.invite_codes i where i.code = new.invite_code and i.kind = 'poc';
  end if;
  return null;
end;
$$;

create trigger duel_rounds_badges after update of submitted_at on public.duel_rounds
  for each row execute function public.badges_after_duel();

-- Backfill: certificates for every contact of an approved registration, then badges.
insert into public.certificates (registration_id, contact_id, recipient_name)
select c.registration_id, c.id, c.name
from public.contacts c join public.registrations r on r.id = c.registration_id
where r.status = 'approved'
on conflict (contact_id) do nothing;

do $$
begin
  perform public.refresh_badges(r.id) from (select id from public.registrations where status = 'approved' order by created_at) r;
end;
$$;

-- ---------- POC invite link ----------
-- The POC's own invite code for a registration (created on first call) + how many people came through it.
create or replace function public.my_invite(p_registration_id uuid)
returns table (code text, plays int, registrations int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_name text;
begin
  if v_uid is null or not public.is_registration_poc(p_registration_id) then
    raise exception 'Not your registration.' using errcode = '42501';
  end if;
  select i.code into v_code from public.invite_codes i where i.kind = 'poc' and i.user_id = v_uid and i.registration_id = p_registration_id;
  if v_code is null then
    -- First name: the user's own contact on this registration, else their sign-up name.
    select split_part(btrim(c.name), ' ', 1) into v_name
    from public.contacts c join auth.users u on lower(u.email) = lower(c.email)
    where c.registration_id = p_registration_id and u.id = v_uid limit 1;
    if v_name is null then
      select split_part(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ' ', 1) into v_name from auth.users u where u.id = v_uid;
    end if;
    insert into public.invite_codes (code, kind, user_id, registration_id, display_name, college_id)
    select public.new_invite_code(), 'poc', v_uid, r.id, left(nullif(v_name, ''), 24), r.college_id
    from public.registrations r where r.id = p_registration_id
    on conflict do nothing
    returning invite_codes.code into v_code;
    if v_code is null then  -- created concurrently
      select i.code into v_code from public.invite_codes i where i.kind = 'poc' and i.user_id = v_uid and i.registration_id = p_registration_id;
    end if;
  end if;
  return query
  select v_code,
    (select count(*)::int from public.duel_rounds d where d.invite_code = v_code and d.submitted_at is not null),
    (select count(*)::int from public.registrations r where r.invite_code = v_code);
end;
$$;

-- Admin "Growth": top inviters (POCs and players) by people brought in.
create or replace function public.admin_top_inviters(p_limit int default 50)
returns table (code text, kind text, display_name text, college_name text, plays int, registrations int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
  select x.code, x.kind, x.display_name, x.college_name, x.plays, x.registrations
  from (
    select i.code, i.kind, i.display_name, c.name as college_name, i.created_at,
           (select count(*)::int from public.duel_rounds d where d.invite_code = i.code and d.submitted_at is not null) as plays,
           (select count(*)::int from public.registrations r where r.invite_code = i.code) as registrations
    from public.invite_codes i
    left join public.colleges c on c.id = i.college_id
  ) x
  where x.plays + x.registrations > 0
  order by x.plays + x.registrations desc, x.created_at
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ---------- Public read functions (anon + authenticated; public columns only) ----------

-- The latest approved registration of each college (seasons are a background grouping).
create or replace function public.public_college_race(p_country public.country)
returns table (
  slug text, name text, short_name text, city text, state text, logo_url text,
  players int, prize_pool int, season text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (c.id)
    c.slug, c.name, c.short_name, c.city, c.state,
    coalesce(r.college_logo_url, c.logo_url),
    r.participant_count,
    case when c.country = 'usa' then null else coalesce(r.prize_pool_override, public.calc_prize_pool(r.participant_count)) end,
    l.name
  from public.registrations r
  join public.colleges c on c.id = r.college_id
  join public.leagues l on l.id = r.league_id
  where r.status = 'approved' and c.country = p_country
  order by c.id, l.season desc, r.created_at desc;
$$;

create or replace function public.public_state_counts(p_country public.country)
returns table (state text, colleges int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.state, count(distinct c.id)::int
  from public.registrations r join public.colleges c on c.id = r.college_id
  where r.status = 'approved' and c.country = p_country and coalesce(c.state, '') <> ''
  group by c.state;
$$;

-- Home page numbers + the next league start (any approved college, today or later, in its own country's date).
create or replace function public.public_home_stats()
returns table (colleges int, players int, next_league_start date, season text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(distinct r.college_id)::int from public.registrations r where r.status = 'approved'),
    (select coalesce(sum(r.participant_count), 0)::int from public.registrations r where r.status = 'approved'),
    (select min(r.league_start) from public.registrations r join public.colleges c on c.id = r.college_id
       where r.status = 'approved' and r.league_start >=
         (now() at time zone case c.country when 'usa' then 'America/New_York' else 'Asia/Kolkata' end)::date),
    (select l.name from public.leagues l where l.status in ('upcoming', 'live') order by l.season desc limit 1);
$$;

-- /c/[slug]: the college's latest approved registration, public fields + badges.
create or replace function public.public_college(p_slug text)
returns table (
  slug text, name text, short_name text, city text, state text, country public.country, logo_url text,
  club_name text, season text, players int, prize_pool int, stage public.registration_stage,
  league_start date, league_end date, badges text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.short_name, c.city, c.state, c.country, coalesce(r.college_logo_url, c.logo_url),
         r.club_name, l.name, r.participant_count,
         case when c.country = 'usa' then null else coalesce(r.prize_pool_override, public.calc_prize_pool(r.participant_count)) end,
         public.derive_stage(r.stage_override, r.stage, c.country, r.league_start, r.league_end,
           (select count(*)::int from public.winners w where w.registration_id = r.id),
           (select count(*)::int from public.winners w where w.registration_id = r.id and w.payment_status = 'paid')),
         r.league_start, r.league_end,
         coalesce((select array_agg(b.badge order by b.earned_at) from public.badges b where b.registration_id = r.id), '{}')
  from public.colleges c
  join public.registrations r on r.college_id = c.id and r.status = 'approved'
  join public.leagues l on l.id = r.league_id
  where c.slug = p_slug
  order by l.season desc, r.created_at desc
  limit 1;
$$;

-- /i/CODE preview: first name, college, the score to beat (player links).
create or replace function public.public_invite(p_code text)
returns table (kind text, display_name text, college_name text, college_slug text, college_logo_url text, score int)
language sql
stable
security definer
set search_path = ''
as $$
  select i.kind, i.display_name, c.name, c.slug, c.logo_url, i.score
  from public.invite_codes i
  left join public.colleges c on c.id = i.college_id
  where i.code = p_code;
$$;

-- /certificate/[id]: only while visible and the registration is still approved.
create or replace function public.public_certificate(p_id text)
returns table (id text, recipient_name text, college_name text, college_logo_url text, season text, issued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.id, ce.recipient_name, c.name, coalesce(r.college_logo_url, c.logo_url), l.name, ce.issued_at
  from public.certificates ce
  join public.registrations r on r.id = ce.registration_id and r.status = 'approved'
  join public.colleges c on c.id = r.college_id
  join public.leagues l on l.id = r.league_id
  where ce.id = upper(p_id) and not ce.hidden;
$$;

-- "Top today" (resets at midnight IST): best score per first name + college, hidden entries excluded.
create or replace function public.top_duels_today(p_limit int default 10)
returns table (player_name text, college_name text, college_slug text, score int)
language sql
stable
security definer
set search_path = ''
as $$
  select player_name, college_name, college_slug, score from (
    select distinct on (lower(d.player_name), d.college_id)
      d.player_name, c.name as college_name, c.slug as college_slug, d.score, d.submitted_at
    from public.duel_rounds d
    left join public.colleges c on c.id = d.college_id
    where d.submitted_at is not null and not d.hidden and d.player_name is not null
      and (d.submitted_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    order by lower(d.player_name), d.college_id, d.score desc, d.submitted_at
  ) best
  order by score desc, submitted_at
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------- Row Level Security ----------
alter table public.invite_codes  enable row level security;
alter table public.duel_rounds   enable row level security;
alter table public.certificates  enable row level security;
alter table public.badges        enable row level security;

create policy "invite_codes read" on public.invite_codes for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "duel_rounds admin read"  on public.duel_rounds for select to authenticated using (public.is_admin());
create policy "duel_rounds admin hide"  on public.duel_rounds for update to authenticated
  using (public.is_admin_writer()) with check (public.is_admin_writer());

create policy "certificates read" on public.certificates for select to authenticated
  using (public.is_admin() or public.is_registration_poc(registration_id));
create policy "certificates hide" on public.certificates for update to authenticated
  using (public.is_admin_writer() or public.is_registration_poc(registration_id))
  with check (public.is_admin_writer() or public.is_registration_poc(registration_id));

create policy "badges read" on public.badges for select to authenticated
  using (public.is_admin() or public.is_registration_poc(registration_id));

-- ---------- Grants ----------
revoke all on public.invite_codes, public.duel_rounds, public.certificates, public.badges from public, anon, authenticated;
grant select on public.invite_codes, public.duel_rounds, public.certificates, public.badges to authenticated;
grant update (hidden) on public.duel_rounds to authenticated;
grant update (hidden) on public.certificates to authenticated;
grant all on public.invite_codes, public.duel_rounds, public.certificates, public.badges to service_role;

-- Public functions: everyone.
do $$
declare f text;
begin
  foreach f in array array[
    'public.public_college_race(public.country)', 'public.public_state_counts(public.country)', 'public.public_home_stats()',
    'public.public_college(text)', 'public.public_invite(text)', 'public.public_certificate(text)', 'public.top_duels_today(int)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end;
$$;

-- Signed-in only.
revoke all on function public.my_invite(uuid) from public, anon;
grant execute on function public.my_invite(uuid) to authenticated;
revoke all on function public.refresh_my_badges(uuid) from public, anon;
grant execute on function public.refresh_my_badges(uuid) to authenticated;
revoke all on function public.admin_top_inviters(int) from public, anon;
grant execute on function public.admin_top_inviters(int) to authenticated;
revoke all on function public.slugify(text) from public, anon;
grant execute on function public.slugify(text) to authenticated, service_role;

-- Internal.
revoke all on function public.refresh_badges(uuid) from public, anon, authenticated;
grant execute on function public.refresh_badges(uuid) to service_role;
revoke all on function public.invite_count(uuid) from public, anon, authenticated;
revoke all on function public.new_invite_code() from public, anon, authenticated;
grant execute on function public.new_invite_code() to service_role;
revoke all on function public.new_certificate_id() from public, anon, authenticated;
revoke all on function public.colleges_set_slug() from public, anon, authenticated;
revoke all on function public.certificates_protect() from public, anon, authenticated;
revoke all on function public.registrations_sync_certificates() from public, anon, authenticated;
revoke all on function public.contacts_sync_certificates() from public, anon, authenticated;
revoke all on function public.badges_after_registration() from public, anon, authenticated;
revoke all on function public.badges_after_child() from public, anon, authenticated;
revoke all on function public.badges_after_duel() from public, anon, authenticated;
