-- =============================================================
-- 0008 · Interactive POC registration
--   registrations: target_players, email_verified_at (Verified fast lane), admin_first_viewed_at ("Under review"),
--                  pass_code (Campus Lead Pass link)
--   registration_drafts (autosave) · join_requests ("Ask to join") · squad_invites (/j/CODE co-lead links)
--   email_verifications (6-digit codes, hashed by the server; never readable by users)
--   claim screen: college_claim_status() · ticker/rivalry/early-bird public functions · public_pass()
-- RLS on every new table; anon only through the public_* functions, which return no personal data.
-- =============================================================

-- ---------- Registrations: new columns ----------
alter table public.registrations
  add column target_players        int check (target_players between 50 and 1000),
  add column email_verified_at     timestamptz,
  add column admin_first_viewed_at timestamptz,
  add column pass_code             text not null default substr(md5(gen_random_uuid()::text), 1, 12);

alter table public.registrations add constraint registrations_pass_code_key unique (pass_code);
alter table public.registrations add constraint registrations_pass_code_check check (pass_code ~ '^[a-z0-9]{12}$');

-- Same as 0007, plus: email_verified_at / admin_first_viewed_at / pass_code are set by the database only, and the
-- POC's target_players follows the detail fields (editable while pending or denied).
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
    if coalesce(current_setting('app.flow_bypass', true), '') <> 'on' then
      new.email_verified_at     := old.email_verified_at;
      new.admin_first_viewed_at := old.admin_first_viewed_at;
    end if;
    new.pass_code           := old.pass_code;
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
      new.target_players     := old.target_players;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- Drafts (autosave, one per user, resume on any device) ----------
create table public.registration_drafts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint registration_drafts_size_check check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 16384)
);

create trigger registration_drafts_updated_at before update on public.registration_drafts
  for each row execute function public.set_updated_at();

-- ---------- Email verification codes ----------
-- The server makes the 6-digit code and stores only its HMAC (code_hash); users can't read this table at all.
create table public.email_verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text not null check (email = lower(email) and email like '%@%'),
  code_hash    text not null check (length(code_hash) between 32 and 128),
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index email_verifications_user_idx on public.email_verifications (user_id, created_at desc);

-- Verified = the registration's college email has a verified code from one of its POCs.
create or replace function public.email_is_verified(p_registration_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is not null and exists (
    select 1 from public.email_verifications v
    where v.email = lower(p_email) and v.verified_at is not null
      and (v.user_id in (select a.user_id from public.college_access a where a.registration_id = p_registration_id)
           or v.user_id = (select r.created_by from public.registrations r where r.id = p_registration_id))
  );
$$;

-- On insert (create_my_registration) and whenever the college email changes, the flag follows the email.
-- Fires after registrations_protect_admin_fields (trigger names sort alphabetically).
create or replace function public.registrations_set_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.college_email is not null and exists (
      select 1 from public.email_verifications v
      where v.user_id = new.created_by and v.email = lower(new.college_email) and v.verified_at is not null
    ) then
      new.email_verified_at := now();
    end if;
  elsif new.college_email is distinct from old.college_email then
    new.email_verified_at := case when public.email_is_verified(new.id, new.college_email) then now() end;
  end if;
  return new;
end;
$$;

create trigger registrations_set_email_verified
  before insert or update of college_email on public.registrations
  for each row execute function public.registrations_set_email_verified();

-- Starts a code for the signed-in user (rate-limited: 1 per 45 s, 5 per hour). Returns the row id.
create or replace function public.start_email_verification(p_email text, p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid college email.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('email_verification:' || v_uid::text));
  if exists (select 1 from public.email_verifications where user_id = v_uid and created_at > now() - interval '45 seconds') then
    raise exception 'Wait a moment before asking for another code.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.email_verifications where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many codes. Try again in an hour.' using errcode = 'P0001';
  end if;
  insert into public.email_verifications (user_id, email, code_hash, expires_at)
  values (v_uid, v_email, p_code_hash, now() + interval '10 minutes')
  returning id into v_id;
  return v_id;
end;
$$;

-- Checks a code against the newest unexpired one for this email: 'ok', 'wrong:<tries left>', 'locked' or 'expired'.
-- On 'ok' it also marks the user's registration with that college email as verified.
create or replace function public.check_email_verification(p_email text, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v       public.email_verifications;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into v from public.email_verifications
  where user_id = v_uid and email = v_email and verified_at is null
  order by created_at desc limit 1
  for update;
  if v.id is null or v.expires_at < now() then
    return 'expired';
  end if;
  if v.attempts >= 5 then
    return 'locked';
  end if;
  if v.code_hash <> p_code_hash then
    update public.email_verifications set attempts = attempts + 1 where id = v.id;
    return case when v.attempts + 1 >= 5 then 'locked' else 'wrong:' || (4 - v.attempts) end;
  end if;
  update public.email_verifications set verified_at = now(), attempts = attempts + 1 where id = v.id;
  perform set_config('app.flow_bypass', 'on', true);
  update public.registrations r set email_verified_at = now()
  where r.email_verified_at is null and lower(r.college_email) = v_email and public.is_registration_poc(r.id);
  perform set_config('app.flow_bypass', '', true);
  return 'ok';
end;
$$;

create or replace function public.my_email_verified(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.email_verifications v
    where v.user_id = auth.uid() and v.email = lower(btrim(p_email)) and v.verified_at is not null
  );
$$;

-- ---------- "Under review": the first time an admin opens the registration ----------
create or replace function public.mark_registration_viewed(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  perform set_config('app.flow_bypass', 'on', true);
  update public.registrations set admin_first_viewed_at = now()
  where id = p_registration_id and admin_first_viewed_at is null;
  perform set_config('app.flow_bypass', '', true);
end;
$$;

-- ---------- The season the claim screen is about (newest non-completed; never creates one) ----------
create or replace function public.active_league_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.leagues l where l.status <> 'completed' order by l.season desc, l.created_at desc limit 1;
$$;

-- A user who already has (or helps run) a registration can't claim, join or redeem another.
create or replace function public.user_has_registration(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.college_access a where a.user_id = p_user_id)
      or exists (
        select 1 from public.registrations r
        where r.created_by = p_user_id
           or lower(r.poc_email) = (select lower(u.email) from auth.users u where u.id = p_user_id)
      );
$$;

-- "Ravi Kumar" → "Ravi K."
create or replace function public.short_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(btrim(p_name), '') = '' then 'a Campus Lead'
    when array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1 then btrim(p_name)
    else split_part(btrim(p_name), ' ', 1) || ' ' || upper(left((regexp_split_to_array(btrim(p_name), '\s+'))[2], 1)) || '.'
  end;
$$;

-- ---------- Claim screen: is each college claimed this season? (signed-in users only) ----------
-- Claimed = a pending, waitlisted or approved registration in the active season. claimed_by is first name + last
-- initial of its primary contact; nothing else about the team.
create or replace function public.college_claim_status(p_college_ids uuid[])
returns table (college_id uuid, registration_id uuid, claimed_by text, status public.registration_status)
language sql
stable
security definer
set search_path = ''
as $$
  select r.college_id, r.id, public.short_name(pc.name), r.status
  from public.registrations r
  left join public.contacts pc on pc.registration_id = r.id and pc.is_primary
  where auth.uid() is not null
    and r.college_id = any (p_college_ids[1:20])
    and r.league_id = public.active_league_id()
    and r.status in ('pending', 'waitlisted', 'approved');
$$;

-- ---------- Join requests ("Already claimed by Ravi K. · Ask to join") ----------
create table public.join_requests (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (length(name) between 1 and 120),
  email            text not null,
  phone            text,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  decided_by       uuid references auth.users(id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);

create unique index join_requests_one_pending on public.join_requests (user_id) where status = 'pending';
create index join_requests_registration_idx on public.join_requests (registration_id, status);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('registration', 'review', 'announcement', 'badge', 'team'));

create or replace function public.notify_registration_pocs(p_registration_id uuid, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, registration_id)
  select p.user_id, 'team', p_title, p_body, p_link, p_registration_id from public.registration_poc_users(p_registration_id) p;
$$;

-- Gives a user access to a registration and makes them a contact (or links the contact the POC already added with
-- their email). The contacts trigger enforces max 3. Internal.
create or replace function public.add_team_member(p_registration_id uuid, p_user_id uuid, p_invited_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name  text;
  v_phone text;
begin
  select lower(u.email), coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
         nullif(btrim(u.raw_user_meta_data ->> 'phone'), '')
    into v_email, v_name, v_phone
  from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'That account no longer exists.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contacts c where c.registration_id = p_registration_id and lower(c.email) = v_email) then
    begin
      insert into public.contacts (registration_id, role, name, email, phone) values (p_registration_id, 'poc', v_name, v_email, v_phone);
    exception when check_violation then
      raise exception 'This team already has 3 people.' using errcode = 'P0001';
    end;
  end if;
  insert into public.college_access (user_id, registration_id, invited_by) values (p_user_id, p_registration_id, p_invited_by)
  on conflict do nothing;
end;
$$;

create or replace function public.request_to_join(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_reg     public.registrations;
  v_name    text;
  v_email   text;
  v_phone   text;
  v_college text;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'Matiks admins can''t join a college team.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('create_my_registration:' || v_uid::text));
  if public.user_has_registration(v_uid) then
    raise exception 'You already have a college registration.' using errcode = 'P0001';
  end if;
  select * into v_reg from public.registrations where id = p_registration_id;
  if v_reg.id is null or v_reg.status not in ('pending', 'waitlisted', 'approved') or v_reg.league_id is distinct from public.active_league_id() then
    raise exception 'That team isn''t taking requests.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contacts where registration_id = p_registration_id) >= 3 then
    raise exception 'This team already has 3 people.' using errcode = 'P0001';
  end if;
  select lower(u.email), coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
         nullif(btrim(u.raw_user_meta_data ->> 'phone'), '')
    into v_email, v_name, v_phone
  from auth.users u where u.id = v_uid;
  -- One pending request at a time: asking another team replaces the old request.
  update public.join_requests set status = 'cancelled', decided_at = now() where user_id = v_uid and status = 'pending';
  insert into public.join_requests (registration_id, user_id, name, email, phone)
  values (p_registration_id, v_uid, left(v_name, 120), v_email, v_phone)
  returning id into v_id;
  select c.name into v_college from public.colleges c where c.id = v_reg.college_id;
  perform public.notify_registration_pocs(p_registration_id, public.short_name(v_name) || ' wants to join your team',
    'Accept or decline in the Register tab (' || v_college || ').', '/college#team');
  return v_id;
end;
$$;

create or replace function public.decide_join_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v         public.join_requests;
  v_college text;
begin
  select * into v from public.join_requests where id = p_request_id for update;
  if v.id is null or not (public.is_registration_poc(v.registration_id) or public.is_admin_writer()) then
    raise exception 'Request not found.' using errcode = 'P0001';
  end if;
  if v.status <> 'pending' then
    raise exception 'This request was already answered.' using errcode = 'P0001';
  end if;
  select c.name into v_college from public.registrations r join public.colleges c on c.id = r.college_id where r.id = v.registration_id;
  if p_accept then
    perform pg_advisory_xact_lock(hashtext('create_my_registration:' || v.user_id::text));
    if public.user_has_registration(v.user_id) then
      update public.join_requests set status = 'cancelled', decided_at = now(), decided_by = v_uid where id = v.id;
      raise exception 'They already joined another college.' using errcode = 'P0001';
    end if;
    perform public.add_team_member(v.registration_id, v.user_id, v_uid);
  end if;
  update public.join_requests set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now(), decided_by = v_uid
  where id = v.id;
  insert into public.notifications (user_id, kind, title, body, link, registration_id)
  values (v.user_id, 'team',
    case when p_accept then 'You''re on the ' || v_college || ' team' else 'Your request to join ' || v_college || ' was declined' end,
    case when p_accept then 'You can now see the registration, chat with Matiks and add winners.' else 'You can claim another college or ask a different team.' end,
    '/college', case when p_accept then v.registration_id end);
end;
$$;

create or replace function public.cancel_my_join_request(p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.join_requests set status = 'cancelled', decided_at = now()
  where id = p_request_id and user_id = auth.uid() and status = 'pending';
$$;

-- ---------- Squad invites (/j/CODE): personal co-lead links ----------
create table public.squad_invites (
  code             text primary key check (code ~ '^[a-z0-9]{12}$'),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  used_by          uuid references auth.users(id) on delete set null,
  used_at          timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index squad_invites_registration_idx on public.squad_invites (registration_id);

-- The POC's open co-lead links: one per free spot (3 − contacts), made or withdrawn to match.
create or replace function public.my_squad_invites(p_registration_id uuid)
returns table (code text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_free int;
  v_open int;
begin
  if not public.is_registration_poc(p_registration_id) then
    raise exception 'Not your registration.' using errcode = '42501';
  end if;
  perform 1 from public.registrations where id = p_registration_id for update;
  v_free := greatest(0, 3 - (select count(*) from public.contacts where registration_id = p_registration_id));
  if (select status from public.registrations where id = p_registration_id) not in ('pending', 'waitlisted', 'approved') then
    v_free := 0;
  end if;
  select count(*) into v_open from public.squad_invites s
  where s.registration_id = p_registration_id and s.used_at is null and s.revoked_at is null;
  while v_open < v_free loop
    insert into public.squad_invites (code, registration_id, created_by)
    values (substr(md5(gen_random_uuid()::text), 1, 12), p_registration_id, auth.uid());
    v_open := v_open + 1;
  end loop;
  if v_open > v_free then
    update public.squad_invites set revoked_at = now()
    where code in (
      select s.code from public.squad_invites s
      where s.registration_id = p_registration_id and s.used_at is null and s.revoked_at is null
      order by s.created_at desc limit v_open - v_free
    );
  end if;
  return query
    select s.code, s.created_at from public.squad_invites s
    where s.registration_id = p_registration_id and s.used_at is null and s.revoked_at is null
    order by s.created_at;
end;
$$;

-- What /j/CODE shows (anyone with the link): the college and whether the link still works. No names.
create or replace function public.squad_invite_info(p_code text)
returns table (college_name text, college_logo_url text, season text, open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, coalesce(r.college_logo_url, c.logo_url), l.name,
         s.used_at is null and s.revoked_at is null and r.status in ('pending', 'waitlisted', 'approved')
           and (select count(*) from public.contacts x where x.registration_id = r.id) < 3
  from public.squad_invites s
  join public.registrations r on r.id = s.registration_id
  join public.colleges c on c.id = r.college_id
  join public.leagues l on l.id = r.league_id
  where s.code = lower(btrim(p_code));
$$;

-- The signed-in user redeems a co-lead link: they get access and become a contact. Returns the registration id.
create or replace function public.redeem_squad_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s     public.squad_invites;
  v_status public.registration_status;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'Matiks admins can''t join a college team.' using errcode = 'P0001';
  end if;
  select * into s from public.squad_invites where code = lower(btrim(p_code)) for update;
  if s.code is null or s.used_at is not null or s.revoked_at is not null then
    raise exception 'This invite link has expired. Ask your Campus Lead for a new one.' using errcode = 'P0001';
  end if;
  if public.is_registration_poc(s.registration_id) then
    return s.registration_id;
  end if;
  perform pg_advisory_xact_lock(hashtext('create_my_registration:' || v_uid::text));
  if public.user_has_registration(v_uid) then
    raise exception 'You already have a college registration.' using errcode = 'P0001';
  end if;
  select r.status into v_status from public.registrations r where r.id = s.registration_id;
  if v_status not in ('pending', 'waitlisted', 'approved') then
    raise exception 'This invite link has expired. Ask your Campus Lead for a new one.' using errcode = 'P0001';
  end if;
  perform public.add_team_member(s.registration_id, v_uid, s.created_by);
  update public.squad_invites set used_by = v_uid, used_at = now() where code = s.code;
  update public.join_requests set status = 'cancelled', decided_at = now() where user_id = v_uid and status = 'pending';
  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)) into v_name from auth.users u where u.id = v_uid;
  perform public.notify_registration_pocs(s.registration_id, public.short_name(v_name) || ' joined your team',
    'They used your co-lead link.', '/college#team');
  return s.registration_id;
end;
$$;

-- ---------- Public: activity ticker, state rivalry, early-bird spots, Campus Lead Pass ----------
-- Ticker: approved colleges by name ("VIT Vellore is in!"), new registrations by state only. Never people.
create or replace function public.public_activity_feed(p_limit int default 12)
returns table (kind text, label text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select 'approved'::text, c.name, coalesce(r.reviewed_at, r.updated_at)
    from public.registrations r join public.colleges c on c.id = r.college_id
    where r.status = 'approved' and r.league_id = public.active_league_id()
    union all
    select 'registered'::text, coalesce(nullif(btrim(c.state), ''), case c.country when 'usa' then 'the USA' else 'India' end), r.created_at
    from public.registrations r join public.colleges c on c.id = r.college_id
    where r.status in ('pending', 'waitlisted', 'approved') and r.league_id = public.active_league_id()
      and r.created_at > now() - interval '30 days'
  ) x (kind, label, at)
  order by at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

-- "4 colleges from Odisha are in": approved colleges this season in a state (case-insensitive).
create or replace function public.public_state_rivalry(p_state text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct r.college_id)::int
  from public.registrations r join public.colleges c on c.id = r.college_id
  where r.status = 'approved' and r.league_id = public.active_league_id()
    and lower(btrim(c.state)) = lower(btrim(p_state));
$$;

-- Early bird = the first 10 approved colleges in the season (refresh_badges, 0007).
create or replace function public.public_early_bird_left()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 10 - count(*))::int from public.registrations r
  where r.status = 'approved' and r.league_id = public.active_league_id();
$$;

-- The pass QR opens /pass/CODE: the college, season and review status. No people. Denied → nothing.
create or replace function public.public_pass(p_code text)
returns table (college_name text, college_logo_url text, season text, status public.registration_status, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, coalesce(r.college_logo_url, c.logo_url), l.name, r.status, case when r.status = 'approved' then c.slug end
  from public.registrations r
  join public.colleges c on c.id = r.college_id
  join public.leagues l on l.id = r.league_id
  where r.pass_code = lower(btrim(p_code)) and r.status in ('pending', 'waitlisted', 'approved');
$$;

-- ---------- Overview view: new columns appended (0005 definition otherwise unchanged) ----------
create or replace view public.registration_overview
with (security_invoker = true)
as
select
  r.id                     as registration_id,
  r.league_id,
  r.college_id,
  c.name                   as college_name,
  c.city,
  c.state,
  r.team_name,
  r.status                 as review_status,
  r.stage,
  r.participant_count,
  case when c.country = 'usa' then null else public.calc_prize_pool(r.participant_count) end as auto_prize_pool,
  r.prize_pool_override,
  case when c.country = 'usa' then coalesce(r.prize_pool_override, 0)
       else coalesce(r.prize_pool_override, public.calc_prize_pool(r.participant_count)) end as prize_pool,
  pc.name                  as primary_poc_name,
  coalesce(w.winners_total, 0)       as winners_total,
  coalesce(w.winners_paid, 0)        as winners_paid,
  coalesce(w.prize_paid_amount, 0)   as prize_paid_amount,
  coalesce(ct.contacts_total, 0)     as contacts_total,
  coalesce(ct.contacts_merch_sent, 0) as contacts_merch_sent,
  r.utm_source,
  r.referral_code,
  r.created_at,
  r.updated_at,
  -- 0005
  c.country,
  l.name                   as league_name,
  r.poc_email,
  pc.email                 as primary_poc_email,
  pc.phone                 as primary_poc_phone,
  r.college_email,
  r.email_domain,
  coalesce(r.college_logo_url, c.logo_url) as college_logo_url,
  r.club_name,
  r.club_logo_url,
  r.registration_start,
  r.league_start,
  r.league_end,
  r.stage_override,
  public.derive_stage(r.stage_override, r.stage, c.country, r.league_start, r.league_end,
                      coalesce(w.winners_total, 0), coalesce(w.winners_paid, 0)) as effective_stage,
  r.deny_reason,
  r.created_by,
  (r.email_domain is not null
    and split_part(lower(r.poc_email), '@', 2) <> r.email_domain
    and split_part(lower(r.poc_email), '@', 2) not like '%.' || r.email_domain) as domain_mismatch,
  exists (select 1 from public.college_access a where a.registration_id = r.id) as has_poc_access,
  -- 0008
  r.target_players,
  r.email_verified_at,
  r.admin_first_viewed_at,
  r.reviewed_at,
  r.pass_code
from public.registrations r
join public.colleges c on c.id = r.college_id
join public.leagues l on l.id = r.league_id
left join public.contacts pc on pc.registration_id = r.id and pc.is_primary
left join lateral (
  select
    count(*)::int                                                       as winners_total,
    count(*) filter (where payment_status = 'paid')::int                as winners_paid,
    coalesce(sum(prize_amount) filter (where payment_status = 'paid'), 0)::int as prize_paid_amount
  from public.winners where registration_id = r.id
) w on true
left join lateral (
  select
    count(*)::int                             as contacts_total,
    count(*) filter (where merch_sent)::int   as contacts_merch_sent
  from public.contacts where registration_id = r.id
) ct on true;

-- ---------- Row Level Security ----------
alter table public.registration_drafts  enable row level security;
alter table public.email_verifications  enable row level security;
alter table public.join_requests        enable row level security;
alter table public.squad_invites        enable row level security;

-- Drafts: each user their own row.
create policy "drafts own" on public.registration_drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- email_verifications: no policies (only the functions above touch it).

-- Join requests: the requester, the team's POCs and admins read; changes only through the functions.
create policy "join_requests read" on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_registration_poc(registration_id) or public.is_admin());

-- Squad invites: the team's POCs and admins read; made and redeemed only through the functions.
create policy "squad_invites read" on public.squad_invites for select to authenticated
  using (public.is_registration_poc(registration_id) or public.is_admin());

-- ---------- Grants ----------
-- Supabase's default privileges grant everything to anon and authenticated; start from nothing.
revoke all on public.registration_drafts, public.email_verifications, public.join_requests, public.squad_invites from anon, authenticated;
grant select, insert, update, delete on public.registration_drafts to authenticated;
grant select on public.join_requests, public.squad_invites to authenticated;

-- Internal helpers: nobody calls them directly.
revoke all on function public.email_is_verified(uuid, text) from public, anon, authenticated;
revoke all on function public.registrations_set_email_verified() from public, anon, authenticated;
revoke all on function public.user_has_registration(uuid) from public, anon, authenticated;
revoke all on function public.add_team_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.notify_registration_pocs(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.active_league_id() from public, anon, authenticated;
revoke all on function public.short_name(text) from public, anon, authenticated;

-- Signed-in users.
revoke all on function public.start_email_verification(text, text) from public, anon;
revoke all on function public.check_email_verification(text, text) from public, anon;
revoke all on function public.my_email_verified(text) from public, anon;
revoke all on function public.mark_registration_viewed(uuid) from public, anon;
revoke all on function public.college_claim_status(uuid[]) from public, anon;
revoke all on function public.request_to_join(uuid) from public, anon;
revoke all on function public.decide_join_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_my_join_request(uuid) from public, anon;
revoke all on function public.my_squad_invites(uuid) from public, anon;
revoke all on function public.redeem_squad_invite(text) from public, anon;
grant execute on function public.start_email_verification(text, text) to authenticated;
grant execute on function public.check_email_verification(text, text) to authenticated;
grant execute on function public.my_email_verified(text) to authenticated;
grant execute on function public.mark_registration_viewed(uuid) to authenticated;
grant execute on function public.college_claim_status(uuid[]) to authenticated;
grant execute on function public.request_to_join(uuid) to authenticated;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_my_join_request(uuid) to authenticated;
grant execute on function public.my_squad_invites(uuid) to authenticated;
grant execute on function public.redeem_squad_invite(text) to authenticated;

-- Anyone (no personal data).
revoke all on function public.squad_invite_info(text) from public;
revoke all on function public.public_activity_feed(int) from public;
revoke all on function public.public_state_rivalry(text) from public;
revoke all on function public.public_early_bird_left() from public;
revoke all on function public.public_pass(text) from public;
grant execute on function public.squad_invite_info(text) to anon, authenticated;
grant execute on function public.public_activity_feed(int) to anon, authenticated;
grant execute on function public.public_state_rivalry(text) to anon, authenticated;
grant execute on function public.public_early_bird_left() to anon, authenticated;
grant execute on function public.public_pass(text) to anon, authenticated;
