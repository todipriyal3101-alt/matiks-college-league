-- =============================================================
-- 0003 — League operations (docs/SPEC.md "League operations")
-- Per registration (= one college in one season): stage, participant count,
-- prize pool override, contact merch + primary, winners, POC access, activity log,
-- registration_overview view, find_user_id_by_email().
--
-- Admin-only rules use the same pattern as protect_registration_admin_fields():
--   auth.role() = 'authenticated' and not is_admin_writer()  →  "non-admin"
-- (service_role and the SQL editor are treated as admin).
-- =============================================================

-- ---------- Enums ----------
create type public.registration_stage as enum ('registration_phase', 'live', 'ended_prize_pending', 'ended_prize_sent');
create type public.tshirt_size        as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL');
create type public.prize_type         as enum ('cash', 'cash_plus_merch', 'merch_only');
create type public.payment_status     as enum ('pending', 'paid');

-- Shared "is this caller a non-admin user?" check, used by every guard below.
create or replace function public.is_non_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated' and not public.is_admin_writer();
$$;

-- ---------- Registrations: stage, participants, prize pool ----------
alter table public.registrations
  add column stage               public.registration_stage not null default 'registration_phase',
  add column participant_count   int not null default 0,
  add column prize_pool_override int,
  add constraint registrations_participant_count_check   check (participant_count >= 0),
  add constraint registrations_prize_pool_override_check check (prize_pool_override >= 0);

create index registrations_stage_idx on public.registrations (stage);

-- Auto prize pool tier. Must match PRIZE_TIERS in src/lib/league.ts.
create or replace function public.calc_prize_pool(p_count int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_count >= 600 then 10000
    when p_count >= 400 then 7500
    when p_count >= 200 then 5000
    else 3000
  end;
$$;

-- Non-admins can't change stage, participant_count or prize_pool_override either.
create or replace function public.protect_registration_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin_writer() then
    new.status              := old.status;
    new.admin_notes         := old.admin_notes;
    new.reviewed_by         := old.reviewed_by;
    new.reviewed_at         := old.reviewed_at;
    new.league_id           := old.league_id;
    new.college_id          := old.college_id;
    new.poc_email           := old.poc_email;
    new.referral_code       := old.referral_code;
    new.utm_source          := old.utm_source;
    new.utm_medium          := old.utm_medium;
    new.utm_campaign        := old.utm_campaign;
    new.utm_content         := old.utm_content;
    new.stage               := old.stage;
    new.participant_count   := old.participant_count;
    new.prize_pool_override := old.prize_pool_override;
  end if;
  return new;
end;
$$;

-- ---------- Contacts: primary, T-shirt, address, merch ----------
alter table public.contacts
  add column is_primary        boolean not null default false,
  add column tshirt_size       public.tshirt_size,
  add column address           text,
  add column pincode           text,
  add column merch_description text,
  add column merch_sent        boolean not null default false,
  add column merch_sent_at     timestamptz;

-- Backfill: the earliest 'poc' contact of each registration is primary
-- (falling back to the earliest contact of any role, so every registration with contacts has one).
update public.contacts c
set is_primary = true
from (
  select distinct on (registration_id) id
  from public.contacts
  order by registration_id, (role = 'poc') desc, created_at, id
) first_contact
where c.id = first_contact.id;

create unique index contacts_one_primary_per_registration
  on public.contacts (registration_id) where is_primary;

-- Max 3 contacts; first contact becomes primary; non-admins can't set merch fields or is_primary
-- (forced on insert, kept on update) or move a contact; merch_sent_at is automatic.
create or replace function public.contacts_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_non_admin   boolean := public.is_non_admin_user();
  v_has_primary boolean;
begin
  if tg_op = 'INSERT' then
    -- Serialise inserts per registration so the 3-contact limit holds under concurrency.
    perform 1 from public.registrations where id = new.registration_id for update;

    if (select count(*) from public.contacts where registration_id = new.registration_id) >= 3 then
      raise exception 'A college can have at most 3 contacts'
        using errcode = 'check_violation';
    end if;

    v_has_primary := exists (
      select 1 from public.contacts where registration_id = new.registration_id and is_primary
    );

    if v_non_admin then
      new.merch_description := null;
      new.merch_sent        := false;
      new.is_primary        := not v_has_primary;
    elsif not v_has_primary then
      new.is_primary := true;
    end if;

    new.merch_sent_at := case when new.merch_sent then now() end;
  else
    if v_non_admin then
      new.registration_id   := old.registration_id;
      new.is_primary        := old.is_primary;
      new.merch_description := old.merch_description;
      new.merch_sent        := old.merch_sent;
      new.merch_sent_at     := old.merch_sent_at;
    elsif new.merch_sent is distinct from old.merch_sent then
      new.merch_sent_at := case when new.merch_sent then now() end;
    end if;
  end if;
  return new;
end;
$$;

create trigger contacts_before_write
  before insert or update on public.contacts
  for each row execute function public.contacts_before_write();

-- Non-admins can't delete the primary contact.
create or replace function public.contacts_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_primary and public.is_non_admin_user() then
    raise exception 'The primary contact can''t be removed'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

create trigger contacts_before_delete
  before delete on public.contacts
  for each row execute function public.contacts_before_delete();

-- When an admin removes the primary contact, the earliest remaining contact becomes primary.
create or replace function public.contacts_promote_primary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_primary then
    update public.contacts
    set is_primary = true
    where id = (
      select id from public.contacts
      where registration_id = old.registration_id
      order by created_at, id
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger contacts_promote_primary
  after delete on public.contacts
  for each row execute function public.contacts_promote_primary();

-- ---------- Winners ----------
create table public.winners (
  id                 uuid primary key default gen_random_uuid(),
  registration_id    uuid not null references public.registrations(id) on delete cascade,
  position           text not null,                -- "1st", "2nd", "Best newcomer"
  name               text,
  email              text,
  phone              text,
  matiks_username    text,
  upi_id             text,
  tshirt_size        public.tshirt_size,
  address            text,
  pincode            text,
  -- Admin-only from here down.
  prize_type         public.prize_type not null default 'cash',
  prize_amount       int not null default 0,
  merch_description  text,
  payment_status     public.payment_status not null default 'pending',
  paid_at            timestamptz,                   -- automatic
  payment_reference  text,                          -- UTR
  merch_sent         boolean not null default false,
  merch_sent_at      timestamptz,                   -- automatic
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint winners_position_check     check (length(btrim(position)) > 0),
  constraint winners_prize_amount_check check (prize_amount >= 0)
);

create index winners_registration_idx on public.winners (registration_id);

create trigger winners_updated_at before update on public.winners
  for each row execute function public.set_updated_at();

-- Non-admins: prize/merch/payment fields forced to defaults on insert and kept on update;
-- a paid winner can't be changed at all. paid_at / merch_sent_at are automatic.
create or replace function public.winners_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_non_admin_user() then
    if tg_op = 'INSERT' then
      new.prize_type        := 'cash';
      new.prize_amount      := 0;
      new.merch_description := null;
      new.payment_status    := 'pending';
      new.payment_reference := null;
      new.merch_sent        := false;
    else
      if old.payment_status = 'paid' then
        if row(new.*) is distinct from row(old.*) then
          raise exception 'This winner has been paid and is locked. Contact a Matiks admin to change it.'
            using errcode = 'insufficient_privilege';
        end if;
        return new;
      end if;
      new.registration_id   := old.registration_id;
      new.prize_type        := old.prize_type;
      new.prize_amount      := old.prize_amount;
      new.merch_description := old.merch_description;
      new.payment_status    := old.payment_status;
      new.paid_at           := old.paid_at;
      new.payment_reference := old.payment_reference;
      new.merch_sent        := old.merch_sent;
      new.merch_sent_at     := old.merch_sent_at;
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.paid_at       := case when new.payment_status = 'paid' then now() end;
    new.merch_sent_at := case when new.merch_sent then now() end;
  else
    if new.payment_status is distinct from old.payment_status then
      new.paid_at := case when new.payment_status = 'paid' then now() end;
    end if;
    if new.merch_sent is distinct from old.merch_sent then
      new.merch_sent_at := case when new.merch_sent then now() end;
    end if;
  end if;
  return new;
end;
$$;

create trigger winners_before_write
  before insert or update on public.winners
  for each row execute function public.winners_before_write();

-- ---------- College access (invited POC logins) ----------
create table public.college_access (
  user_id          uuid not null references auth.users(id) on delete cascade,
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  invited_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, registration_id)
);

create index college_access_registration_idx on public.college_access (registration_id);

create trigger college_access_updated_at before update on public.college_access
  for each row execute function public.set_updated_at();

-- POC = invited via college_access, or logged in with the registration's poc_email.
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
  )
  or exists (
    select 1 from public.registrations r
    where r.id = reg_id
      and coalesce(auth.jwt() ->> 'email', '') <> ''
      and lower(r.poc_email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ---------- Activity log (written only by triggers) ----------
-- Append-only, so no updated_at.
create table public.activity_log (
  id               bigint generated always as identity primary key,
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  actor_id         uuid references auth.users(id) on delete set null,
  actor_email      text,                           -- snapshot for the timeline
  entity           text not null,                  -- registration | winner | contact
  entity_id        uuid not null,
  action           text not null,                  -- added | changed
  field            text,
  old_value        text,
  new_value        text,
  meta             jsonb,                          -- e.g. winner position/name, UTR
  created_at       timestamptz not null default now(),
  constraint activity_log_entity_check check (entity in ('registration', 'winner', 'contact')),
  constraint activity_log_action_check check (action in ('added', 'changed'))
);

create index activity_log_registration_idx on public.activity_log (registration_id, created_at desc);

create or replace function public.log_activity(
  p_registration_id uuid, p_entity text, p_entity_id uuid, p_action text,
  p_field text, p_old text, p_new text, p_meta jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_log
    (registration_id, actor_id, actor_email, entity, entity_id, action, field, old_value, new_value, meta)
  values
    (p_registration_id, auth.uid(), auth.jwt() ->> 'email', p_entity, p_entity_id, p_action,
     p_field, p_old, p_new, p_meta);
$$;

create or replace function public.registrations_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'status', old.status::text, new.status::text, null);
  end if;
  if new.stage is distinct from old.stage then
    perform public.log_activity(new.id, 'registration', new.id, 'changed', 'stage', old.stage::text, new.stage::text, null);
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

create trigger registrations_log_activity
  after update on public.registrations
  for each row execute function public.registrations_log_activity();

create or replace function public.winners_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := jsonb_build_object('position', new.position, 'name', new.name);
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.registration_id, 'winner', new.id, 'added', null, null, new.position, v_meta);
    return null;
  end if;
  if new.payment_status is distinct from old.payment_status then
    perform public.log_activity(new.registration_id, 'winner', new.id, 'changed', 'payment_status',
      old.payment_status::text, new.payment_status::text,
      v_meta || jsonb_build_object('payment_reference', new.payment_reference));
  end if;
  if new.prize_amount is distinct from old.prize_amount then
    perform public.log_activity(new.registration_id, 'winner', new.id, 'changed', 'prize_amount',
      old.prize_amount::text, new.prize_amount::text, v_meta);
  end if;
  if new.merch_sent is distinct from old.merch_sent then
    perform public.log_activity(new.registration_id, 'winner', new.id, 'changed', 'merch_sent',
      old.merch_sent::text, new.merch_sent::text, v_meta);
  end if;
  if new.upi_id is distinct from old.upi_id then
    perform public.log_activity(new.registration_id, 'winner', new.id, 'changed', 'upi_id',
      old.upi_id, new.upi_id, v_meta);
  end if;
  return null;
end;
$$;

create trigger winners_log_activity
  after insert or update on public.winners
  for each row execute function public.winners_log_activity();

create or replace function public.contacts_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.merch_sent is distinct from old.merch_sent then
    perform public.log_activity(new.registration_id, 'contact', new.id, 'changed', 'merch_sent',
      old.merch_sent::text, new.merch_sent::text, jsonb_build_object('name', new.name));
  end if;
  return null;
end;
$$;

create trigger contacts_log_activity
  after update on public.contacts
  for each row execute function public.contacts_log_activity();

-- ---------- Overview view ----------
create view public.registration_overview
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
  public.calc_prize_pool(r.participant_count)                                 as auto_prize_pool,
  r.prize_pool_override,
  coalesce(r.prize_pool_override, public.calc_prize_pool(r.participant_count)) as prize_pool,
  pc.name                  as primary_poc_name,
  coalesce(w.winners_total, 0)       as winners_total,
  coalesce(w.winners_paid, 0)        as winners_paid,
  coalesce(w.prize_paid_amount, 0)   as prize_paid_amount,
  coalesce(ct.contacts_total, 0)     as contacts_total,
  coalesce(ct.contacts_merch_sent, 0) as contacts_merch_sent,
  r.utm_source,
  r.referral_code,
  r.created_at,
  r.updated_at
from public.registrations r
join public.colleges c on c.id = r.college_id
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

-- ---------- Invite lookup (server only) ----------
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;

-- ---------- Row Level Security ----------
alter table public.winners        enable row level security;
alter table public.college_access enable row level security;
alter table public.activity_log   enable row level security;

-- winners: POC reads/adds/edits own (paid lock in trigger), deletes own unpaid; admins read; writers write.
create policy "winners poc read"    on public.winners for select to authenticated using (public.is_registration_poc(registration_id));
create policy "winners poc insert"  on public.winners for insert to authenticated with check (public.is_registration_poc(registration_id));
create policy "winners poc update"  on public.winners for update to authenticated using (public.is_registration_poc(registration_id)) with check (public.is_registration_poc(registration_id));
create policy "winners poc delete"  on public.winners for delete to authenticated using (public.is_registration_poc(registration_id) and payment_status <> 'paid');
create policy "winners admin read"  on public.winners for select to authenticated using (public.is_admin());
create policy "winners admin write" on public.winners for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- college_access: a user sees their own rows; admins see all; only writers manage.
create policy "college_access self read"   on public.college_access for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "college_access admin write" on public.college_access for all    to authenticated using (public.is_admin_writer()) with check (public.is_admin_writer());

-- activity_log: read-only for clients (admins all, POCs their own). No insert/update/delete policies.
create policy "activity_log read" on public.activity_log for select to authenticated
  using (public.is_admin() or public.is_registration_poc(registration_id));

-- ---------- Grants (anon gets nothing on new objects) ----------
revoke all on public.winners, public.college_access, public.activity_log, public.registration_overview
  from public, anon;
grant select, insert, update, delete on public.winners, public.college_access to authenticated;
grant all on public.winners, public.college_access to service_role;
-- The log is written only by the security-definer triggers above.
revoke all on public.activity_log from authenticated, service_role;
grant select on public.activity_log to authenticated, service_role;
grant select on public.registration_overview to authenticated, service_role;

revoke all on function public.calc_prize_pool(int) from public, anon;
grant execute on function public.calc_prize_pool(int) to authenticated, service_role;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

revoke all on function public.log_activity(uuid, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.is_non_admin_user() from public, anon;
grant execute on function public.is_non_admin_user() to authenticated, service_role;
revoke all on function public.is_registration_poc(uuid) from public, anon;
grant execute on function public.is_registration_poc(uuid) to authenticated, service_role;

-- Trigger functions are never called directly.
revoke all on function public.contacts_before_write()      from public, anon, authenticated;
revoke all on function public.contacts_before_delete()     from public, anon, authenticated;
revoke all on function public.contacts_promote_primary()   from public, anon, authenticated;
revoke all on function public.winners_before_write()       from public, anon, authenticated;
revoke all on function public.registrations_log_activity() from public, anon, authenticated;
revoke all on function public.winners_log_activity()       from public, anon, authenticated;
revoke all on function public.contacts_log_activity()      from public, anon, authenticated;
