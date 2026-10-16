-- =============================================================
-- 0004 — Merge duplicate colleges + public approved-colleges wall
-- (docs/SPEC.md "League operations > Duplicate colleges"; PROMPTS Phase 11)
-- =============================================================

-- ---------- merge_colleges(keep, duplicate) ----------
-- Moves the duplicate's registrations, matches and ambassadors to the kept college, fills the kept
-- college's empty fields from the duplicate, deletes the duplicate. One transaction; all or nothing.
-- Refuses (P0001, readable message) when both colleges registered for the same season, or played
-- each other (merging would make a college play itself). Called by an admin-only server action.
create or replace function public.merge_colleges(p_keep uuid, p_duplicate uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep       public.colleges;
  v_dup        public.colleges;
  v_seasons    text;
  v_regs       int;
  v_matches    int;
  v_ambassadors int;
begin
  if p_keep = p_duplicate then
    raise exception 'Pick two different colleges.' using errcode = 'P0001';
  end if;

  -- Lock both rows so concurrent merges/edits can't interleave.
  select * into v_keep from public.colleges where id = p_keep for update;
  select * into v_dup  from public.colleges where id = p_duplicate for update;
  if v_keep.id is null or v_dup.id is null then
    raise exception 'College not found.' using errcode = 'P0002';
  end if;

  select string_agg(l.name, ', ' order by l.season) into v_seasons
  from public.registrations a
  join public.registrations b on b.league_id = a.league_id and b.college_id = p_duplicate
  join public.leagues l on l.id = a.league_id
  where a.college_id = p_keep;
  if v_seasons is not null then
    raise exception 'Both colleges are registered for %. Delete or keep only one of those registrations first.', v_seasons
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.matches m
    where (m.college_a_id = p_keep and m.college_b_id = p_duplicate)
       or (m.college_a_id = p_duplicate and m.college_b_id = p_keep)
  ) then
    raise exception 'These colleges have a match against each other. Delete that match first.' using errcode = 'P0001';
  end if;

  update public.registrations set college_id = p_keep where college_id = p_duplicate;
  get diagnostics v_regs = row_count;

  update public.matches
  set college_a_id = case when college_a_id = p_duplicate then p_keep else college_a_id end,
      college_b_id = case when college_b_id = p_duplicate then p_keep else college_b_id end,
      winner_id    = case when winner_id    = p_duplicate then p_keep else winner_id end
  where p_duplicate in (college_a_id, college_b_id, winner_id);
  get diagnostics v_matches = row_count;

  update public.ambassadors set college_id = p_keep where college_id = p_duplicate;
  get diagnostics v_ambassadors = row_count;

  update public.colleges
  set short_name = coalesce(short_name, v_dup.short_name),
      city       = coalesce(city, v_dup.city),
      state      = coalesce(state, v_dup.state),
      website    = coalesce(website, v_dup.website),
      logo_url   = coalesce(logo_url, v_dup.logo_url),
      college_type = case when college_type = 'other' then v_dup.college_type else college_type end
  where id = p_keep;

  delete from public.colleges where id = p_duplicate;

  return jsonb_build_object(
    'kept', v_keep.name,
    'removed', v_dup.name,
    'registrations', v_regs,
    'matches', v_matches,
    'ambassadors', v_ambassadors
  );
end;
$$;

revoke all on function public.merge_colleges(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_colleges(uuid, uuid) to service_role;

-- ---------- public_approved_colleges(league) ----------
-- The public /colleges wall: approved colleges of a non-draft season, public fields only.
-- anon has no access to registrations, so this exposes exactly what the wall needs and nothing else.
create or replace function public.public_approved_colleges(p_league_id uuid)
returns table (id uuid, name text, short_name text, city text, state text, logo_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.short_name, c.city, c.state, c.logo_url
  from public.registrations r
  join public.colleges c on c.id = r.college_id
  join public.leagues l on l.id = r.league_id
  where r.league_id = p_league_id
    and r.status = 'approved'
    and l.status <> 'draft'
  order by c.name;
$$;

revoke all on function public.public_approved_colleges(uuid) from public;
grant execute on function public.public_approved_colleges(uuid) to anon, authenticated, service_role;
