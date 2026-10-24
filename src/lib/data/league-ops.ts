import "server-only";

import { cache } from "react";

import type { Tables } from "@/lib/database.types";
import type { Stage } from "@/lib/league";
import { createClient } from "@/lib/supabase/server";

// League operations reads. All use the LOGGED-IN user's client, so RLS decides what each person sees
// (admins/viewers: everything; POCs: their own registrations; others: nothing).

export type OverviewRow = Tables<"registration_overview">;

/** Every registration of a season, from registration_overview. */
export async function getOverview(leagueId: string): Promise<OverviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registration_overview")
    .select("*")
    .eq("league_id", leagueId)
    .order("college_name");
  if (error) throw new Error(`getOverview: ${error.message}`);
  return data;
}

export type RegistrationDetail = {
  registration: Tables<"registrations"> & {
    colleges: Pick<Tables<"colleges">, "id" | "name" | "short_name" | "city" | "state" | "country" | "logo_url">;
    leagues: Pick<Tables<"leagues">, "id" | "name" | "season" | "registration_deadline">;
  };
  contacts: Tables<"contacts">[];
  winners: Tables<"winners">[];
  participants: Pick<Tables<"participants">, "id" | "name" | "matiks_username" | "year">[];
  activity: Tables<"activity_log">[];
  /** From registration_overview (migration 0005): the derived stage and flags. */
  derived: {
    effectiveStage: Stage;
    hasPocAccess: boolean;
    domainMismatch: boolean;
    /** 0009: someone with access hasn't proven they own their email. */
    pocUnverified: boolean;
  };
};

/**
 * Everything the CollegeEditor needs for one registration, or null if the user can't see it.
 * Uncached: server actions call it after writing, so they must not get the pre-save result.
 */
export async function fetchRegistrationDetail(id: string): Promise<RegistrationDetail | null> {
  const supabase = await createClient();
  const { data: registration, error } = await supabase
    .from("registrations")
    .select("*, colleges(id, name, short_name, city, state, country, logo_url), leagues(id, name, season, registration_deadline)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRegistrationDetail: ${error.message}`);
  if (!registration) return null;

  const [contacts, winners, participants, activity, overview] = await Promise.all([
    supabase.from("contacts").select("*").eq("registration_id", id).order("is_primary", { ascending: false }).order("created_at"),
    supabase.from("winners").select("*").eq("registration_id", id).order("created_at"),
    supabase.from("participants").select("id, name, matiks_username, year").eq("registration_id", id).order("created_at"),
    supabase.from("activity_log").select("*").eq("registration_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("registration_overview").select("effective_stage, has_poc_access, domain_mismatch, poc_unverified").eq("registration_id", id).maybeSingle(),
  ]);
  for (const r of [contacts, winners, participants, activity, overview]) {
    if (r.error) throw new Error(`getRegistrationDetail: ${r.error.message}`);
  }

  return {
    registration,
    contacts: contacts.data ?? [],
    winners: winners.data ?? [],
    participants: participants.data ?? [],
    activity: activity.data ?? [],
    derived: {
      effectiveStage: (overview.data?.effective_stage ?? registration.stage) as Stage,
      hasPocAccess: !!overview.data?.has_poc_access,
      domainMismatch: !!overview.data?.domain_mismatch,
      pocUnverified: !!overview.data?.poc_unverified,
    },
  };
}

/** Cached per request, for pages. */
export const getRegistrationDetail = cache(fetchRegistrationDetail);

export type MyRegistration = Pick<Tables<"registrations">, "id" | "team_name" | "stage" | "status"> & {
  colleges: Pick<Tables<"colleges">, "name" | "city">;
  leagues: Pick<Tables<"leagues">, "id" | "name" | "season" | "status">;
};

/**
 * Registrations the logged-in user is a POC for (college_access only since 0009: a matching poc_email no longer
 * counts, because emails aren't verified), newest season first. Admins only get registrations they're personally a
 * POC of, not everything.
 */
export const getMyRegistrations = cache(async (): Promise<MyRegistration[]> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return [];

  const access = await supabase.from("college_access").select("registration_id").eq("user_id", userId);
  if (access.error) throw new Error(`getMyRegistrations: ${access.error.message}`);
  const ids = (access.data ?? []).map((a) => a.registration_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("registrations")
    .select("id, team_name, stage, status, colleges(name, city), leagues(id, name, season, status)")
    .in("id", ids);
  if (error) throw new Error(`getMyRegistrations: ${error.message}`);
  return data.sort((a, b) => b.leagues.season - a.leagues.season);
});
