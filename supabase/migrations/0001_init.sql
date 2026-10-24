-- =============================================================
-- Matiks College League Portal — initial schema
-- Tables, enums, triggers, helper functions and RLS policies.
-- =============================================================

-- ---------- Enums ----------
create type public.league_status       as enum ('draft', 'upcoming', 'live', 'completed');
create type public.registration_status as enum ('pending', 'approved', 'waitlisted', 'rejected');
create type public.college_type        as enum ('iit', 'nit', 'iiit', 'bits', 'government', 'private', 'other');
create type public.contact_role        as enum ('poc', 'captain', 'faculty');
create type public.admin_role          as enum ('admin', 'viewer');

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Tables ----------
create table public.leagues (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,                 -- "Matiks College League"
  slug                   text not null unique,          -- "matiks-college-league"
  season                 int  not null,
  start_date             date,
  end_date               date,
  registration_deadline  timestamptz,
  registration_open      boolean not null default false,
  max_colleges           int,
  status                 public.league_status not null default 'draft',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.colleges (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  short_name       text,
  normalized_name  text generated always as (lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))) stored,
  city             text,
  state            text,
  college_type     public.college_type not null default 'other',
  website          text,
  logo_url         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint colleges_normalized_name_key unique (normalized_name)
);

create table public.ambassadors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text,
  phone          text,
  college_id     uuid references public.colleges(id) on delete set null,
  referral_code  text not null unique,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.registrations (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  college_id     uuid not null references public.colleges(id) on delete restrict,
  status         public.registration_status not null default 'pending',
  team_name      text,
  poc_email      text not null,                      -- used for magic-link access to /my
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  referral_code  text,                               -- matches ambassadors.referral_code
  admin_notes    text,
  reviewed_by    uuid references auth.users(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint registrations_league_college_key unique (league_id, college_id)
);

create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  role             public.contact_role not null default 'poc',
  name             text not null,
  email            text not null,
  phone            text,
  year             text,
  course           text,
  matiks_username  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.participants (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  name             text not null,
  email            text,
  matiks_username  text not null,
  year             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  round         text not null,                       -- "Group A", "Quarterfinal"
  college_a_id  uuid not null references public.colleges(id) on delete restrict,
  college_b_id  uuid not null references public.colleges(id) on delete restrict,
  scheduled_at  timestamptz,
  score_a       int,
  score_b       int,
  winner_id     uuid references public.colleges(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint matches_different_colleges check (college_a_id <> college_b_id)
);

create table public.admin_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text not null,
  role        public.admin_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index registrations_league_idx       on public.registrations (league_id);
create index registrations_status_idx       on public.registrations (status);
create index registrations_poc_email_idx    on public.registrations (lower(poc_email));
create index registrations_referral_idx     on public.registrations (referral_code);
create index registrations_created_idx      on public.registrations (created_at);
create index contacts_registration_idx      on public.contacts (registration_id);
create index participants_registration_idx  on public.participants (registration_id);
create index matches_league_idx             on public.matches (league_id);
create index colleges_name_search_idx       on public.colleges (lower(name) text_pattern_ops);

-- ---------- updated_at triggers ----------
create trigger leagues_updated_at        before update on public.leagues        for each row execute function public.set_updated_at();
create trigger colleges_updated_at       before update on public.colleges       for each row execute function public.set_updated_at();
create trigger ambassadors_updated_at    before update on public.ambassadors    for each row execute function public.set_updated_at();
create trigger registrations_updated_at  before update on public.registrations  for each row execute function public.set_updated_at();
create trigger contacts_updated_at       before update on public.contacts       for each row execute function public.set_updated_at();
create trigger participants_updated_at   before update on public.participants   for each row execute function public.set_updated_at();
create trigger matches_updated_at        before update on public.matches        for each row execute function public.set_updated_at();
create trigger admin_profiles_updated_at before update on public.admin_profiles for each row execute function public.set_updated_at();

-- ---------- Role helpers (security definer so RLS on admin_profiles doesn't recurse) ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid());
$$;

create or replace function public.is_admin_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid() and role = 'admin');
$$;

-- True when the logged-in user is the POC of this registration (matched by email)
create or replace function public.is_registration_poc(reg_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.registrations r
    where r.id = reg_id
      and lower(r.poc_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Students (POCs) may edit team details, but never status, review fields, league, college or POC email.
create or replace function public.protect_registration_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin_writer() then
    new.status        := old.status;
    new.admin_notes   := old.admin_notes;
    new.reviewed_by   := old.reviewed_by;
    new.reviewed_at   := old.reviewed_at;
    new.league_id     := old.league_id;
    new.college_id    := old.college_id;
    new.poc_email     := old.poc_email;
    new.referral_code := old.referral_code;
    new.utm_source    := old.utm_source;
    new.utm_medium    := old.utm_medium;
    new.utm_campaign  := old.utm_campaign;
    new.utm_content   := old.utm_content;
  end if;
  return new;
end;
$$;

create trigger registrations_protect_admin_fields
  before update on public.registrations
  for each row execute function public.protect_registration_admin_fields();

-- ---------- Row Level Security ----------
alter table public.leagues        enable row level security;
alter table public.colleges       enable row level security;
alter table public.ambassadors    enable row level security;
alter table public.registrations  enable row level security;
alter table public.contacts       enable row level security;
alter table public.participants   enable row level security;
alter table public.matches        enable row level security;
alter table public.admin_profiles enable row level security;

-- leagues: public read (non-draft), admin full
create policy "leagues public read"   on public.leagues for select to anon, authenticated using (status <> 'draft' or public.is_admin());
create policy "leagues admin write"   on public.leagues for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- colleges: public read (needed for autocomplete + colleges wall), admin write
create policy "colleges public read"  on public.colleges for select to anon, authenticated using (true);
create policy "colleges admin write"  on public.colleges for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- matches: public read, admin write
create policy "matches public read"   on public.matches for select to anon, authenticated using (true);
create policy "matches admin write"   on public.matches for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- ambassadors: admin only
create policy "ambassadors admin read"  on public.ambassadors for select to authenticated using (public.is_admin());
create policy "ambassadors admin write" on public.ambassadors for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- registrations: POC reads/updates own; admins read; admin writers write.
-- Inserts happen in a server action with the service role key (bypasses RLS) after validation.
create policy "registrations poc read"    on public.registrations for select to authenticated using (public.is_registration_poc(id));
create policy "registrations poc update"  on public.registrations for update to authenticated using (public.is_registration_poc(id)) with check (public.is_registration_poc(id));
create policy "registrations admin read"  on public.registrations for select to authenticated using (public.is_admin());
create policy "registrations admin write" on public.registrations for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- contacts: POC manages own registration's contacts; admins read; writers write
create policy "contacts poc all"     on public.contacts for all    to authenticated using (public.is_registration_poc(registration_id)) with check (public.is_registration_poc(registration_id));
create policy "contacts admin read"  on public.contacts for select to authenticated using (public.is_admin());
create policy "contacts admin write" on public.contacts for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- participants: same as contacts
create policy "participants poc all"     on public.participants for all    to authenticated using (public.is_registration_poc(registration_id)) with check (public.is_registration_poc(registration_id));
create policy "participants admin read"  on public.participants for select to authenticated using (public.is_admin());
create policy "participants admin write" on public.participants for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- admin_profiles: a user sees their own row; admins see all; only admin writers manage
create policy "admin_profiles self read"   on public.admin_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin_profiles admin write" on public.admin_profiles for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- NOTE: the anon role has NO policy on registrations, contacts, participants, ambassadors
-- or admin_profiles, so the public can never read student data.
