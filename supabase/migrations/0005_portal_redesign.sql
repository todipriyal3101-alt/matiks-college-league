-- =============================================================
-- 0005 — Portal redesign (POC self-registration, chats, notifications, logos)
--   colleges.country · registration details (college email + domain, logos, club, 3 dates)
--   stage_override + derived stage · deny_reason · create_my_registration() / resubmit_my_registration()
--   storage bucket "logos" · chat_threads / chat_messages / chat_reads · notifications
--   send_poc_notification() · registration_overview (new columns appended) · realtime
--
-- Same "non-admin" rule as 0003: auth.role() = 'authenticated' and not is_admin_writer().
-- =============================================================

-- ---------- Country ----------
create type public.country as enum ('india', 'usa');

alter table public.colleges
  add column country public.country not null default 'india';

-- ---------- Registrations: details the POC fills in ----------
alter table public.registrations
  add column created_by         uuid references auth.users(id) on delete set null,  -- the POC who self-registered
  add column college_email      text,
  add column email_domain       text,            -- lowercase, no "@": iitg.ac.in
  add column college_logo_url   text,
  add column club_name          text,            -- "Hosted by"
  add column club_logo_url      text,
  add column registration_start date,
  add column league_start       date,
  add column league_end         date,
  add column stage_override     public.registration_stage,   -- null = derived from the dates
  add column deny_reason        text,
  add constraint registrations_dates_order check (
    (registration_start is null or league_start is null or registration_start <= league_start)
    and (league_start is null or league_end is null or league_start <= league_end)
  ),
  add constraint registrations_email_domain_check check (
    email_domain is null
    or email_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  add constraint registrations_college_email_check check (
    college_email is null or (length(college_email) <= 254 and college_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
  ),
  -- Logos must be files in our own public "logos" bucket (no hotlinking arbitrary URLs).
  add constraint registrations_college_logo_check check (
    college_logo_url is null
    or (length(college_logo_url) <= 500 and college_logo_url ~ '^https?://[^/]+/storage/v1/object/public/logos/[A-Za-z0-9/_.-]+$')
  ),
  add constraint registrations_club_logo_check check (
    club_logo_url is null
    or (length(club_logo_url) <= 500 and club_logo_url ~ '^https?://[^/]+/storage/v1/object/public/logos/[A-Za-z0-9/_.-]+$')
  ),
  add constraint registrations_club_name_check   check (club_name is null or length(club_name) <= 100),
  add constraint registrations_deny_reason_check check (deny_reason is null or length(deny_reason) <= 500);

-- One self-registration per user, ever (they can edit it, or resubmit it after a denial).
create unique index registrations_one_per_creator on public.registrations (created_by) where created_by is not null;

-- ---------- Derived stage ----------
-- Before league start = Registration; start..end = Live; after end = Prize pending until every winner is paid
-- (and there is at least one), then Complete. An admin override always wins. Without dates (older rows),
-- the stored stage column is used as before. "Today" is the college's own country's date.
create or replace function public.derive_stage(
  p_override       public.registration_stage,
  p_stored         public.registration_stage,
  p_country        public.country,
  p_league_start   date,
  p_league_end     date,
  p_winners_total  int,
  p_winners_paid   int
)
returns public.registration_stage
language sql
stable
set search_path = ''
as $$
  select coalesce(p_override, case
    when p_league_start is null then p_stored
    when (now() at time zone case p_country when 'usa' then 'America/New_York' else 'Asia/Kolkata' end)::date < p_league_start
      then 'registration_phase'::public.registration_stage
    when p_league_end is null
      or (now() at time zone case p_country when 'usa' then 'America/New_York' else 'Asia/Kolkata' end)::date <= p_league_end
      then 'live'::public.registration_stage
    when p_winners_total > 0 and p_winners_paid >= p_winners_total
      then 'ended_prize_sent'::public.registration_stage
    else 'ended_prize_pending'::public.registration_stage
  end);
$$;

-- ---------- Admin-only fields (replaces the 0003 version) ----------
-- New: stage_override, deny_reason and created_by are admin-only; the POC's detail fields can be edited only
-- while the registration is pending or denied (to fix and resubmit), never after approval.
-- app.review_bypass is set (transaction-local) only by resubmit_my_registration() below.
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

-- Activity log: also the stage override and the deny reason (replaces the 0003 version).
create or replace function public.registrations_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'status', old.status::text, new.status::text,
      case when new.status = 'rejected' and new.deny_reason is not null then jsonb_build_object('reason', new.deny_reason) end);
  end if;
  if new.stage is distinct from old.stage then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'stage', old.stage::text, new.stage::text, null);
  end if;
  if new.stage_override is distinct from old.stage_override then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'stage_override',
      old.stage_override::text, new.stage_override::text, null);
  end if;
  if new.participant_count is distinct from old.participant_count then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'participant_count',
      old.participant_count::text, new.participant_count::text, null);
  end if;
  if new.prize_pool_override is distinct from old.prize_pool_override then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'prize_pool_override',
      old.prize_pool_override::text, new.prize_pool_override::text, null);
  end if;
  return null;
end;
$$;

-- ---------- Notifications ----------
create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null,
  title            text not null,
  body             text,
  link             text,                         -- in-app path, e.g. /admin/colleges?status=pending
  registration_id  uuid references public.registrations(id) on delete cascade,
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  constraint notifications_kind_check  check (kind in ('registration', 'review', 'announcement')),
  constraint notifications_title_check check (length(btrim(title)) between 1 and 200),
  constraint notifications_body_check  check (body is null or length(body) <= 2000),
  constraint notifications_link_check  check (link is null or (link ~ '^/[^/\\]' and length(link) <= 300))
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Users with POC access to a registration: invited (college_access) or logged in with its poc_email.
create or replace function public.registration_poc_users(p_registration_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email
  from auth.users u
  where u.id in (select a.user_id from public.college_access a where a.registration_id = p_registration_id)
     or exists (
       select 1 from public.registrations r
       where r.id = p_registration_id and lower(r.poc_email) = lower(u.email)
     );
$$;

-- Every admin and viewer.
create or replace function public.notify_admins(p_kind text, p_title text, p_body text, p_link text, p_registration_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, registration_id)
  select ap.user_id, p_kind, p_title, p_body, p_link, p_registration_id from public.admin_profiles ap;
$$;

-- Tell the POCs when their college is approved or denied.
create or replace function public.registrations_notify_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_college text;
begin
  if new.status is not distinct from old.status or new.status not in ('approved', 'rejected') then
    return null;
  end if;
  select name into v_college from public.colleges where id = new.college_id;
  insert into public.notifications (user_id, kind, title, body, link, registration_id)
  select p.user_id, 'review',
         case when new.status = 'approved' then v_college || ' is approved' else v_college || ' was not approved' end,
         case when new.status = 'approved' then 'Your college is in. Check the dates and add winners when the league ends.'
              else coalesce('Reason: ' || new.deny_reason, 'Open the Register tab for details, or message us in Chat.') end,
         '/college', new.id
  from public.registration_poc_users(new.id) p;
  return null;
end;
$$;

create trigger registrations_notify_review
  after update of status on public.registrations
  for each row execute function public.registrations_notify_review();

-- ---------- Chats ----------
-- One thread per registration (= the college's chat with Matiks) plus one "Matiks Admins" thread.
create table public.chat_threads (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null,
  registration_id  uuid unique references public.registrations(id) on delete cascade,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chat_threads_kind_check check (kind in ('college', 'admins')),
  constraint chat_threads_kind_registration check ((kind = 'college') = (registration_id is not null))
);

create unique index chat_threads_one_admins on public.chat_threads (kind) where kind = 'admins';
create index chat_threads_last_message_idx on public.chat_threads (last_message_at desc nulls last);

create trigger chat_threads_updated_at before update on public.chat_threads
  for each row execute function public.set_updated_at();

insert into public.chat_threads (kind) values ('admins');
insert into public.chat_threads (kind, registration_id) select 'college', id from public.registrations;

create or replace function public.registrations_create_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_threads (kind, registration_id) values ('college', new.id) on conflict (registration_id) do nothing;
  return null;
end;
$$;

create trigger registrations_create_thread
  after insert on public.registrations
  for each row execute function public.registrations_create_thread();

create table public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,
  sender_id    uuid references auth.users(id) on delete set null,
  sender_name  text not null default '',
  sender_role  text not null default 'poc',
  body         text not null,
  created_at   timestamptz not null default now(),
  constraint chat_messages_role_check check (sender_role in ('admin', 'poc')),
  constraint chat_messages_body_check check (length(btrim(body)) between 1 and 4000)
);

create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at desc);

-- Who can read a thread: admins/viewers all; POCs their own college's thread.
create or replace function public.can_read_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id and t.kind = 'college' and public.is_registration_poc(t.registration_id)
  );
$$;

-- Who can post: admin writers in any thread; POCs in their own college's thread. Viewers never.
create or replace function public.can_post_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.chat_threads t where t.id = p_thread_id)
     and (public.is_admin_writer() or exists (
       select 1 from public.chat_threads t
       where t.id = p_thread_id and t.kind = 'college' and public.is_registration_poc(t.registration_id)
     ));
$$;

-- Sender id/name/role and the time are set here, never trusted from the client.
create or replace function public.chat_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_name text;
  v_meta_name  text;
  v_email      text;
begin
  new.created_at := now();
  if auth.role() = 'authenticated' then
    new.sender_id := auth.uid();
  end if;
  select ap.name, ap.email into v_admin_name, v_email from public.admin_profiles ap where ap.user_id = new.sender_id;
  if found then
    new.sender_role := 'admin';
    new.sender_name := coalesce(nullif(btrim(v_admin_name), ''), split_part(v_email, '@', 1));
  else
    select nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email into v_meta_name, v_email
    from auth.users u where u.id = new.sender_id;
    new.sender_role := 'poc';
    new.sender_name := coalesce(v_meta_name, split_part(coalesce(v_email, 'POC'), '@', 1));
  end if;
  return new;
end;
$$;

create trigger chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function public.chat_messages_before_insert();

create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads set last_message_at = new.created_at where id = new.thread_id;
  -- The sender has read their own message.
  if new.sender_id is not null then
    insert into public.chat_reads (thread_id, user_id, last_read_at) values (new.thread_id, new.sender_id, new.created_at)
    on conflict (thread_id, user_id) do update set last_read_at = greatest(public.chat_reads.last_read_at, excluded.last_read_at);
  end if;
  return null;
end;
$$;

create table public.chat_reads (
  thread_id     uuid not null references public.chat_threads(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index chat_reads_user_idx on public.chat_reads (user_id);

create trigger chat_messages_after_insert
  after insert on public.chat_messages
  for each row execute function public.chat_messages_after_insert();

-- The chat list for the logged-in user, newest first, with unread counts. Security invoker: RLS decides
-- which threads come back (admins: all; POCs: their own).
create or replace function public.my_chat_threads()
returns table (
  thread_id        uuid,
  kind             text,
  registration_id  uuid,
  college_name     text,
  college_logo_url text,
  country          public.country,
  last_message_at  timestamptz,
  last_body        text,
  last_sender      text,
  unread           int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.kind, t.registration_id, c.name, coalesce(r.college_logo_url, c.logo_url), c.country,
         t.last_message_at, lm.body, lm.sender_name,
         (select count(*)::int from public.chat_messages m
           where m.thread_id = t.id
             and m.sender_id is distinct from auth.uid()
             and m.created_at > coalesce(cr.last_read_at, '-infinity'::timestamptz))
  from public.chat_threads t
  left join public.registrations r on r.id = t.registration_id
  left join public.colleges c on c.id = r.college_id
  left join public.chat_reads cr on cr.thread_id = t.id and cr.user_id = auth.uid()
  left join lateral (
    select m.body, m.sender_name from public.chat_messages m
    where m.thread_id = t.id order by m.created_at desc limit 1
  ) lm on true
  order by (t.kind = 'admins') desc, t.last_message_at desc nulls last, c.name;
$$;

-- ---------- Self-registration ----------
-- A logged-in user with no college may create exactly one PENDING registration for themselves, in the active
-- season. They become its primary contact and get POC access; every admin gets a notification.
-- Errors: P0001 with a readable message; 23505 when the college is already registered this season.
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
  v_league      public.leagues;
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

  -- One at a time per user, so two quick submits can't both pass the check below.
  perform pg_advisory_xact_lock(hashtext('create_my_registration:' || v_uid::text));
  if exists (select 1 from public.registrations r where r.created_by = v_uid or lower(r.poc_email) = v_email)
     or exists (select 1 from public.college_access a where a.user_id = v_uid) then
    raise exception 'You already have a college registration.' using errcode = 'P0001';
  end if;

  select * into v_league from public.leagues l
  where l.status in ('upcoming', 'live')
  order by l.season desc, l.created_at desc
  limit 1;
  if v_league.id is null or not v_league.registration_open
     or (v_league.registration_deadline is not null and v_league.registration_deadline < now()) then
    raise exception 'Registrations are closed right now.' using errcode = 'P0001';
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

  insert into public.registrations (
    league_id, college_id, status, poc_email, created_by,
    college_email, email_domain, college_logo_url, club_name, club_logo_url,
    registration_start, league_start, league_end,
    utm_source, utm_medium, utm_campaign, utm_content, referral_code
  )
  values (
    v_league.id, v_college_id, 'pending', v_email, v_uid,
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

-- After a denial, the POC fixes the details and sends it back for review.
create or replace function public.resubmit_my_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_college text;
begin
  if not public.is_registration_poc(p_registration_id) then
    raise exception 'Not your registration.' using errcode = '42501';
  end if;
  perform set_config('app.review_bypass', 'on', true);
  update public.registrations
  set status = 'pending', deny_reason = null, reviewed_by = null, reviewed_at = null
  where id = p_registration_id and status = 'rejected';
  if not found then
    perform set_config('app.review_bypass', '', true);
    raise exception 'Only a denied registration can be resubmitted.' using errcode = 'P0001';
  end if;
  perform set_config('app.review_bypass', '', true);

  select c.name into v_college from public.registrations r join public.colleges c on c.id = r.college_id
  where r.id = p_registration_id;
  perform public.notify_admins('registration', 'Resubmitted: ' || v_college,
    v_college || ' updated its details after a denial.', '/admin/colleges?status=pending', p_registration_id);
end;
$$;

-- ---------- Announcements to POCs ----------
-- p_scope: 'all' | 'approved' | 'college' (needs p_registration_id). p_country narrows all/approved.
-- Returns who got it (user id + email) so the server can also email them. Admin writers only.
create or replace function public.send_poc_notification(
  p_title            text,
  p_body             text,
  p_scope            text,
  p_country          public.country default null,
  p_registration_id  uuid default null
)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin_writer() then
    raise exception 'Only admins can send notifications.' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'approved', 'college') or (p_scope = 'college' and p_registration_id is null) then
    raise exception 'Pick who gets it.' using errcode = '22023';
  end if;

  return query
  with targets as (
    select distinct on (pu.user_id) pu.user_id, pu.email, r.id as registration_id
    from public.registrations r
    join public.colleges c on c.id = r.college_id
    cross join lateral public.registration_poc_users(r.id) pu
    where case p_scope
            when 'college'  then r.id = p_registration_id
            when 'approved' then r.status = 'approved'
            else r.status <> 'rejected'
          end
      and (p_scope = 'college' or p_country is null or c.country = p_country)
    order by pu.user_id, r.created_at desc
  ), sent as (
    insert into public.notifications (user_id, kind, title, body, link, registration_id)
    select t.user_id, 'announcement', btrim(p_title), nullif(btrim(p_body), ''), '/college', t.registration_id
    from targets t
    returning notifications.user_id
  )
  select t.user_id, t.email from targets t where t.user_id in (select s.user_id from sent s);
end;
$$;

-- ---------- Logos bucket ----------
-- Public read (served from the public URL); uploads only to the uploader's own folder (users/<uid>/...),
-- to a registration's folder by its POC (registrations/<id>/...), or anywhere by admin writers.
-- Images only (no SVG: it can carry script), max 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_write_logo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_reg   uuid;
begin
  if public.is_admin_writer() then
    return true;
  end if;
  if auth.uid() is null or coalesce(array_length(v_parts, 1), 0) <> 2 then
    return false;
  end if;
  if v_parts[1] = 'users' then
    return v_parts[2] = auth.uid()::text;
  end if;
  if v_parts[1] = 'registrations' and v_parts[2] ~ '^[0-9a-f-]{36}$' then
    v_reg := v_parts[2]::uuid;
    return public.is_registration_poc(v_reg);
  end if;
  return false;
end;
$$;

create policy "logos read own" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.can_write_logo(name));
create policy "logos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.can_write_logo(name));
create policy "logos update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.can_write_logo(name))
  with check (bucket_id = 'logos' and public.can_write_logo(name));
create policy "logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.can_write_logo(name));

-- ---------- Overview view (new columns appended; existing ones unchanged except the USA prize pool) ----------
-- USA has no auto tier: its prize pool is whatever an admin sets (override), else 0.
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
  exists (select 1 from public.college_access a where a.registration_id = r.id) as has_poc_access
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
alter table public.notifications enable row level security;
alter table public.chat_threads  enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads    enable row level security;

-- notifications: each user reads and marks read their own. Rows are created only by the functions above.
create policy "notifications own read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- chat_threads: read what you may read; created only by triggers.
create policy "chat_threads read" on public.chat_threads for select to authenticated using (public.can_read_thread(id));

-- chat_messages: read your threads; post where allowed; nobody edits or deletes (no policies for it).
create policy "chat_messages read"   on public.chat_messages for select to authenticated using (public.can_read_thread(thread_id));
create policy "chat_messages insert" on public.chat_messages for insert to authenticated with check (public.can_post_thread(thread_id));

-- chat_reads: your own read markers, only for threads you can read.
create policy "chat_reads own" on public.chat_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_read_thread(thread_id));

-- ---------- Grants (anon gets nothing on new objects) ----------
-- Supabase's default privileges grant everything to anon + authenticated; start from nothing.
revoke all on public.notifications, public.chat_threads, public.chat_messages, public.chat_reads from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;     -- only the read marker
grant select on public.chat_threads to authenticated;
grant select on public.chat_messages to authenticated;
grant insert (thread_id, body) on public.chat_messages to authenticated;   -- sender/time come from the trigger
grant select, insert, update on public.chat_reads to authenticated;
grant all on public.notifications, public.chat_threads, public.chat_messages, public.chat_reads to service_role;
grant select on public.registration_overview to authenticated, service_role;

revoke all on function public.derive_stage(public.registration_stage, public.registration_stage, public.country, date, date, int, int) from public, anon;
grant execute on function public.derive_stage(public.registration_stage, public.registration_stage, public.country, date, date, int, int) to authenticated, service_role;

revoke all on function public.create_my_registration(uuid, text, public.country, text, text, text, text, text, date, date, date, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_my_registration(uuid, text, public.country, text, text, text, text, text, date, date, date, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.resubmit_my_registration(uuid) from public, anon;
grant execute on function public.resubmit_my_registration(uuid) to authenticated;

revoke all on function public.send_poc_notification(text, text, text, public.country, uuid) from public, anon;
grant execute on function public.send_poc_notification(text, text, text, public.country, uuid) to authenticated;

revoke all on function public.my_chat_threads() from public, anon;
grant execute on function public.my_chat_threads() to authenticated;

revoke all on function public.can_read_thread(uuid) from public, anon;
grant execute on function public.can_read_thread(uuid) to authenticated, service_role;
revoke all on function public.can_post_thread(uuid) from public, anon;
grant execute on function public.can_post_thread(uuid) to authenticated, service_role;
revoke all on function public.can_write_logo(text) from public, anon;
grant execute on function public.can_write_logo(text) to authenticated, service_role;

-- Internal helpers: never called by clients.
revoke all on function public.registration_poc_users(uuid) from public, anon, authenticated;
revoke all on function public.notify_admins(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.registrations_notify_review()   from public, anon, authenticated;
revoke all on function public.registrations_create_thread()   from public, anon, authenticated;
revoke all on function public.chat_messages_before_insert()   from public, anon, authenticated;
revoke all on function public.chat_messages_after_insert()    from public, anon, authenticated;

-- ---------- Realtime ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end;
$$;
