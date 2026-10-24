-- =============================================================
-- 0009 · Access without emails ("Confirm email" is off in Supabase Auth)
--   • POC access comes only from college_access (self-registration, co-lead links, accepted join requests, admins).
--     Matching a registration's poc_email no longer grants anything; existing holders are backfilled.
--   • pending_access: an admin adds a POC who has no account yet. Signing up with that exact email claims it
--     (trigger on auth.users). Expires after 14 days; admins can revoke.
--   • verified_accounts: emails proven by a link (password reset / magic link) or Google, or confirmed under the old
--     setup. Admins see "Email not verified" for everyone else.
--   • Notifications get 'payment' (prize paid, replaces the email).
-- =============================================================

-- ---------- Verified accounts ----------
create table public.verified_accounts (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  verified_at  timestamptz not null default now(),
  method       text not null check (method in ('link', 'google', 'legacy'))
);

-- Before 0009, sign-ups confirmed their email by link, and invites were accepted by link: those are proven.
insert into public.verified_accounts (user_id, verified_at, method)
select u.id, u.email_confirmed_at, 'legacy'
from auth.users u
where u.email_confirmed_at is not null and (u.confirmation_sent_at is not null or u.invited_at is not null)
on conflict do nothing;
insert into public.verified_accounts (user_id, method)
select u.id, 'google' from auth.users u where u.raw_app_meta_data -> 'providers' ? 'google'
on conflict do nothing;

create or replace function public.account_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.verified_accounts v where v.user_id = p_user_id);
$$;

-- ---------- Pending access (admin adds a POC who hasn't signed up) ----------
create table public.pending_access (
  id               uuid primary key default gen_random_uuid(),
  email            text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  invited_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '14 days',
  revoked_at       timestamptz,
  claimed_by       uuid references auth.users(id) on delete set null,
  claimed_at       timestamptz
);

create unique index pending_access_one_open on public.pending_access (registration_id, email)
  where claimed_at is null and revoked_at is null;
create index pending_access_email_idx on public.pending_access (email) where claimed_at is null and revoked_at is null;

-- Gives a new account the access waiting for its exact email (unexpired, unrevoked), with an in-app notification.
create or replace function public.claim_pending_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  if new.email is null then
    return new;
  end if;
  for p in
    select pa.id, pa.registration_id, pa.invited_by, c.name as college
    from public.pending_access pa
    join public.registrations r on r.id = pa.registration_id
    join public.colleges c on c.id = r.college_id
    where pa.email = lower(btrim(new.email)) and pa.claimed_at is null and pa.revoked_at is null and pa.expires_at > now()
  loop
    -- Never block a sign-up: a failure here only skips this entry (the admin can add them again).
    begin
      insert into public.college_access (user_id, registration_id, invited_by) values (new.id, p.registration_id, p.invited_by)
      on conflict do nothing;
      update public.pending_access set claimed_by = new.id, claimed_at = now() where id = p.id;
      insert into public.notifications (user_id, kind, title, body, link, registration_id)
      values (new.id, 'team', 'You can manage ' || p.college, 'A Matiks admin gave you access to this college.', '/college', p.registration_id);
    exception when others then
      raise warning 'claim_pending_access % for %: %', p.id, new.id, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

create trigger on_auth_user_created_claim_access
  after insert on auth.users
  for each row execute function public.claim_pending_access();

-- ---------- Access only through college_access ----------
-- Backfill first, so nobody who reached a college through its poc_email loses it.
insert into public.college_access (user_id, registration_id)
select u.id, r.id
from public.registrations r
join auth.users u on lower(u.email) = lower(r.poc_email)
on conflict do nothing;

-- A registration's email without an account yet (e.g. a college an admin added) gets a pending entry instead.
insert into public.pending_access (email, registration_id)
select distinct lower(btrim(r.poc_email)), r.id
from public.registrations r
where r.status in ('pending', 'waitlisted', 'approved')
  and lower(btrim(r.poc_email)) like '%_@_%'
  and not exists (select 1 from auth.users u where lower(u.email) = lower(r.poc_email))
  and not exists (select 1 from public.college_access a where a.registration_id = r.id)
on conflict do nothing;

create or replace function public.is_registration_poc(reg_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.college_access a
    where a.registration_id = reg_id and a.user_id = auth.uid()
  );
$$;

create or replace function public.registration_poc_users(p_registration_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email
  from auth.users u
  where u.id in (select a.user_id from public.college_access a where a.registration_id = p_registration_id);
$$;

-- ---------- Notifications: prize paid (in-app instead of email) ----------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('registration', 'review', 'announcement', 'badge', 'team', 'payment'));

-- ---------- Overview view: + poc_unverified (0008 definition otherwise unchanged) ----------
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
  r.pass_code,
  -- 0009: someone with access signed up with an email nobody has proven they own
  exists (
    select 1 from public.college_access a
    where a.registration_id = r.id and not public.account_verified(a.user_id)
  ) as poc_unverified
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
alter table public.verified_accounts enable row level security;
alter table public.pending_access    enable row level security;

-- Verified accounts: admins read; written only by the server (service role) and the backfill above.
create policy "verified_accounts admin read" on public.verified_accounts for select to authenticated using (public.is_admin());

-- Pending access: admins read; writers add and revoke. Claimed only by the sign-up trigger.
create policy "pending_access admin read"   on public.pending_access for select to authenticated using (public.is_admin());
create policy "pending_access admin insert" on public.pending_access for insert to authenticated
  with check (public.is_admin_writer() and claimed_at is null and claimed_by is null and revoked_at is null);
create policy "pending_access admin update" on public.pending_access for update to authenticated
  using (public.is_admin_writer()) with check (public.is_admin_writer());

-- ---------- Grants ----------
revoke all on public.verified_accounts, public.pending_access from anon, authenticated;
grant select on public.verified_accounts to authenticated;
grant select, insert on public.pending_access to authenticated;
grant update (revoked_at, expires_at) on public.pending_access to authenticated;

revoke all on function public.claim_pending_access() from public, anon, authenticated;
revoke all on function public.account_verified(uuid) from public, anon;
grant execute on function public.account_verified(uuid) to authenticated, service_role;
-- is_registration_poc / registration_poc_users keep their earlier grants (create or replace keeps them).
