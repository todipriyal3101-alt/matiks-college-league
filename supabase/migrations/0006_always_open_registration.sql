-- =============================================================
-- 0006 — POC self-registration is always open
-- Every college sets its own dates and every registration still needs an admin Approve/Deny, so a season's
-- registration_open switch and deadline no longer gate POCs. New registrations attach to the current season
-- automatically (newest non-completed; created when there is none). Admins keep one emergency switch:
-- app_settings.registrations_paused ("Pause new registrations", default off).
-- =============================================================

-- ---------- App settings (exactly one row) ----------
create table public.app_settings (
  id                    boolean primary key default true,
  registrations_paused  boolean not null default false,
  updated_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint app_settings_single_row check (id)
);

insert into public.app_settings default values;

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Who flipped it, set here (never trusted from the client).
create or replace function public.app_settings_set_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger app_settings_set_updated_by before update on public.app_settings
  for each row execute function public.app_settings_set_updated_by();

alter table public.app_settings enable row level security;

-- Every signed-in user may read it (the Register tab shows "paused"); only admin writers change it.
create policy "app_settings read"        on public.app_settings for select to authenticated using (true);
create policy "app_settings admin write" on public.app_settings for update to authenticated
  using (public.is_admin_writer()) with check (public.is_admin_writer());

revoke all on public.app_settings from public, anon, authenticated;
grant select on public.app_settings to authenticated;
grant update (registrations_paused) on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

-- ---------- A POC can read the season of its own registrations ----------
-- (Drafts are otherwise admin-only; a registration attached to a draft season must still show for its POC.)
create policy "leagues poc read" on public.leagues for select to authenticated
  using (exists (select 1 from public.registrations r where r.league_id = leagues.id and public.is_registration_poc(r.id)));

-- ---------- The season new self-registrations join ----------
-- Newest non-completed season; when there is none, creates "Matiks College League – Season N" (N = next number).
-- Internal: called only by create_my_registration().
create or replace function public.current_registration_season()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_next int;
  v_slug text;
begin
  select l.id into v_id from public.leagues l
  where l.status <> 'completed'
  order by l.season desc, l.created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Two first registrations at once must not create two seasons.
  perform pg_advisory_xact_lock(hashtext('current_registration_season'));
  select l.id into v_id from public.leagues l
  where l.status <> 'completed'
  order by l.season desc, l.created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select coalesce(max(l.season), 0) + 1 into v_next from public.leagues l;
  v_slug := 'mcl-season-' || v_next;
  if exists (select 1 from public.leagues l where l.slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;
  insert into public.leagues (name, slug, season, status, registration_open)
  values ('Matiks College League – Season ' || v_next, v_slug, v_next, 'upcoming', true)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- create_my_registration(): no season gating, only the pause switch ----------
-- Same signature and behaviour as 0005, except: the season is current_registration_season() and the only
-- "closed" case is app_settings.registrations_paused.
create or replace function public.create_my_registration(
  p_college_id          uuid,
  p_college_name        text,
  p_country             public.country,
  p_college_email       text,
  p_email_domain        text,
  p_college_logo_url    text,
  p_club_name           text,
  p_club_logo_url       text,
  p_registration_start  date,
  p_league_start        date,
  p_league_end          date,
  p_poc_name            text,
  p_poc_phone           text,
  p_utm_source          text default null,
  p_utm_medium          text default null,
  p_utm_campaign        text default null,
  p_utm_content         text default null,
  p_referral_code       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_email       text := lower(nullif(btrim(auth.jwt() ->> 'email'), ''));
  v_league_id   uuid;
  v_college_id  uuid := p_college_id;
  v_college     text;
  v_reg_id      uuid;
  v_own_prefix  text;
begin
  if auth.role() is distinct from 'authenticated' or v_uid is null or v_email is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'Matiks admins can''t register a college. Use Add college in the admin panel.' using errcode = 'P0001';
  end if;
  if (select s.registrations_paused from public.app_settings s) then
    raise exception 'New registrations are paused. Message us in the Chat tab.' using errcode = 'P0001';
  end if;

  -- One at a time per user, so two quick submits can't both pass the check below.
  perform pg_advisory_xact_lock(hashtext('create_my_registration:' || v_uid::text));
  if exists (select 1 from public.registrations r where r.created_by = v_uid or lower(r.poc_email) = v_email)
     or exists (select 1 from public.college_access a where a.user_id = v_uid) then
    raise exception 'You already have a college registration.' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_poc_name), '') = '' or coalesce(btrim(p_poc_phone), '') = '' then
    raise exception 'Your name and phone number are required.' using errcode = 'P0001';
  end if;
  if p_registration_start is null or p_league_start is null or p_league_end is null then
    raise exception 'All three dates are required.' using errcode = 'P0001';
  end if;

  -- Logos uploaded before the registration exists live in the user's own folder; nobody else's files.
  v_own_prefix := '/storage/v1/object/public/logos/users/' || v_uid::text || '/';
  if (p_college_logo_url is not null and position(v_own_prefix in p_college_logo_url) = 0)
     or (p_club_logo_url is not null and position(v_own_prefix in p_club_logo_url) = 0) then
    raise exception 'Upload the logos again.' using errcode = 'P0001';
  end if;

  if v_college_id is not null then
    select c.name into v_college from public.colleges c where c.id = v_college_id;
    if v_college is null then
      raise exception 'That college no longer exists. Pick it again.' using errcode = 'P0001';
    end if;
  elsif coalesce(btrim(p_college_name), '') = '' then
    raise exception 'College name is required.' using errcode = 'P0001';
  else
    select c.id, c.name into v_college_id, v_college from public.colleges c
    where c.normalized_name = lower(regexp_replace(p_college_name, '[^a-zA-Z0-9]', '', 'g'));
    if v_college_id is null then
      insert into public.colleges (name, country) values (btrim(p_college_name), coalesce(p_country, 'india'))
      returning id, name into v_college_id, v_college;
    end if;
  end if;

  v_league_id := public.current_registration_season();

  insert into public.registrations (
    league_id, college_id, status, poc_email, created_by,
    college_email, email_domain, college_logo_url, club_name, club_logo_url,
    registration_start, league_start, league_end,
    utm_source, utm_medium, utm_campaign, utm_content, referral_code
  )
  values (
    v_league_id, v_college_id, 'pending', v_email, v_uid,
    lower(nullif(btrim(p_college_email), '')), lower(nullif(btrim(p_email_domain), '')),
    p_college_logo_url, nullif(btrim(p_club_name), ''), p_club_logo_url,
    p_registration_start, p_league_start, p_league_end,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_referral_code
  )
  returning id into v_reg_id;

  insert into public.contacts (registration_id, role, name, email, phone)
  values (v_reg_id, 'poc', btrim(p_poc_name), v_email, btrim(p_poc_phone));

  insert into public.college_access (user_id, registration_id) values (v_uid, v_reg_id);

  perform public.notify_admins('registration', 'New college: ' || v_college,
    btrim(p_poc_name) || ' registered ' || v_college || ' and is waiting for review.',
    '/admin/colleges?status=pending', v_reg_id);

  return v_reg_id;
end;
$$;

-- ---------- Grants ----------
revoke all on function public.current_registration_season() from public, anon, authenticated;
grant execute on function public.current_registration_season() to service_role;
revoke all on function public.app_settings_set_updated_by() from public, anon, authenticated;
-- create_my_registration keeps 0005's grants (create or replace keeps them); restated for clarity.
revoke all on function public.create_my_registration(uuid, text, public.country, text, text, text, text, text, date, date, date, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_my_registration(uuid, text, public.country, text, text, text, text, text, date, date, date, text, text, text, text, text, text, text) to authenticated;
