-- =============================================================
-- 0002 — register_college(): atomic student registration
-- Finds or creates the college, then inserts the registration, the POC contact
-- and participants in one transaction. Called only by the submitRegistration
-- server action through the service role client.
--
-- Duplicates raise unique_violation (23505) from either
--   colleges_normalized_name_key        (two students adding the same new college at once), or
--   registrations_league_college_key    (college already registered for this league);
-- the server action turns both into an "already registered" result.
-- =============================================================

create or replace function public.register_college(
  p_league_id      uuid,
  p_poc            jsonb,                               -- { name, email, phone, year, course, matiks_username }
  p_participants   jsonb default '[]'::jsonb,           -- [ { name, email, matiks_username, year }, ... ]
  p_college_id     uuid default null,                   -- existing college picked in the type-ahead
  p_college_name   text default null,                   -- used when p_college_id is null
  p_college_city   text default null,
  p_college_state  text default null,
  p_college_type   public.college_type default 'other',
  p_team_name      text default null,
  p_utm_source     text default null,
  p_utm_medium     text default null,
  p_utm_campaign   text default null,
  p_utm_content    text default null,
  p_referral_code  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_college_id       uuid := p_college_id;
  v_registration_id  uuid;
begin
  if v_college_id is not null then
    if not exists (select 1 from public.colleges c where c.id = v_college_id) then
      raise exception 'college % not found', v_college_id using errcode = 'P0002';
    end if;
  elsif coalesce(p_college_name, '') = '' then
    raise exception 'college name is required' using errcode = '22023';
  else
    -- Same expression as the generated colleges.normalized_name column.
    select c.id into v_college_id
    from public.colleges c
    where c.normalized_name = lower(regexp_replace(p_college_name, '[^a-zA-Z0-9]', '', 'g'));

    if v_college_id is null then
      insert into public.colleges (name, city, state, college_type)
      values (p_college_name, p_college_city, p_college_state, coalesce(p_college_type, 'other'))
      returning id into v_college_id;
    end if;
  end if;

  insert into public.registrations (
    league_id, college_id, status, team_name, poc_email,
    utm_source, utm_medium, utm_campaign, utm_content, referral_code
  )
  values (
    p_league_id, v_college_id, 'pending', p_team_name, p_poc ->> 'email',
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_referral_code
  )
  returning id into v_registration_id;

  insert into public.contacts (registration_id, role, name, email, phone, year, course, matiks_username)
  values (
    v_registration_id, 'poc',
    p_poc ->> 'name', p_poc ->> 'email', p_poc ->> 'phone',
    p_poc ->> 'year', p_poc ->> 'course', p_poc ->> 'matiks_username'
  );

  insert into public.participants (registration_id, name, email, matiks_username, year)
  select v_registration_id, p ->> 'name', nullif(p ->> 'email', ''), p ->> 'matiks_username', nullif(p ->> 'year', '')
  from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb)) as p;

  return v_registration_id;
end;
$$;

-- Only the service role (server action) may call it. Supabase grants EXECUTE on new
-- public functions to anon/authenticated by default, so revoke those explicitly.
revoke execute on function public.register_college(
  uuid, jsonb, jsonb, uuid, text, text, text, public.college_type, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.register_college(
  uuid, jsonb, jsonb, uuid, text, text, text, public.college_type, text, text, text, text, text, text
) to service_role;
