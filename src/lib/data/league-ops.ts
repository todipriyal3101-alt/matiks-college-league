import "server-only";

import { cache } from "react";

import type { Tables } from "@/lib/database.types";
import type { OverviewFilters } from "@/lib/validation/league-ops";
import { createClient } from "@/lib/supabase/server";

// League operations reads. All use the LOGGED-IN user's client, so RLS decides what each person sees
// (admins/viewers: everything; POCs: their own registrations; others: nothing).

export type OverviewRow = Tables<"registration_overview">;

export type OverviewStats = {
  colleges: number;
  approved: number;
  prizeCommitted: number; // effective prize pools of approved registrations
  prizePaid: number;
  liveNow: number;
  pendingReview: number;
};

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

export function overviewStats(rows: OverviewRow[]): OverviewStats {
  const approved = rows.filter((r) => r.review_status === "approved");
  return {
    colleges: rows.length,
    approved: approved.length,
    prizeCommitted: approved.reduce((sum, r) => sum + (r.prize_pool ?? 0), 0),
    prizePaid: rows.reduce((sum, r) => sum + (r.prize_paid_amount ?? 0), 0),
    liveNow: rows.filter((r) => r.stage === "live").length,
    pendingReview: rows.filter((r) => r.review_status === "pending").length,
  };
}

/** Applies the URL filters. Used by the table and by exports, so an export matches what's on screen. */
/** `peopleMatchIds`: registrations whose winners/contacts match the search (see matchPeople). */
export function filterOverview(rows: OverviewRow[], f: OverviewFilters, peopleMatchIds?: Set<string>): OverviewRow[] {
  const q = f.q.toLowerCase();
  const filtered = rows.filter((r) => {
    if (f.review !== "all" && r.review_status !== f.review) return false;
    if (f.stage !== "all" && r.stage !== f.stage) return false;
    if (f.source !== "all" && (r.utm_source ?? "direct") !== f.source) return false;
    if (!q) return true;
    if (peopleMatchIds?.has(r.registration_id!)) return true;
    return [r.college_name, r.city, r.state, r.primary_poc_name, r.team_name, r.referral_code]
      .some((v) => v?.toLowerCase().includes(q));
  });
  const by: Record<OverviewFilters["sort"], (a: OverviewRow, b: OverviewRow) => number> = {
    college: (a, b) => (a.college_name ?? "").localeCompare(b.college_name ?? ""),
    participants: (a, b) => (b.participant_count ?? 0) - (a.participant_count ?? 0),
    prize: (a, b) => (b.prize_pool ?? 0) - (a.prize_pool ?? 0),
    newest: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  };
  return filtered.sort(by[f.sort]);
}

/** Distinct sources in a season, for the filter dropdown ("direct" = no utm_source). */
export function overviewSources(rows: OverviewRow[]): string[] {
  return [...new Set(rows.map((r) => r.utm_source ?? "direct"))].sort();
}

export type RegistrationDetail = {
  registration: Tables<"registrations"> & {
    colleges: Pick<Tables<"colleges">, "id" | "name" | "short_name" | "city" | "state">;
    leagues: Pick<Tables<"leagues">, "id" | "name" | "season" | "registration_deadline">;
  };
  contacts: Tables<"contacts">[];
  winners: Tables<"winners">[];
  participants: Pick<Tables<"participants">, "id" | "name" | "matiks_username" | "year">[];
  activity: Tables<"activity_log">[];
};

/**
 * Everything the CollegeEditor needs for one registration, or null if the user can't see it.
 * Uncached: server actions call it after writing, so they must not get the pre-save result.
 */
export async function fetchRegistrationDetail(id: string): Promise<RegistrationDetail | null> {
  const supabase = await createClient();
  const { data: registration, error } = await supabase
    .from("registrations")
    .select("*, colleges(id, name, short_name, city, state), leagues(id, name, season, registration_deadline)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRegistrationDetail: ${error.message}`);
  if (!registration) return null;

  const [contacts, winners, participants, activity] = await Promise.all([
    supabase.from("contacts").select("*").eq("registration_id", id).order("is_primary", { ascending: false }).order("created_at"),
    supabase.from("winners").select("*").eq("registration_id", id).order("created_at"),
    supabase.from("participants").select("id, name, matiks_username, year").eq("registration_id", id).order("created_at"),
    supabase.from("activity_log").select("*").eq("registration_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const r of [contacts, winners, participants, activity]) {
    if (r.error) throw new Error(`getRegistrationDetail: ${r.error.message}`);
  }

  return {
    registration,
    contacts: contacts.data ?? [],
    winners: winners.data ?? [],
    participants: participants.data ?? [],
    activity: activity.data ?? [],
  };
}

/** Cached per request, for pages. */
export const getRegistrationDetail = cache(fetchRegistrationDetail);

export type MyRegistration = Pick<Tables<"registrations">, "id" | "team_name" | "stage" | "status"> & {
  colleges: Pick<Tables<"colleges">, "name" | "city">;
  leagues: Pick<Tables<"leagues">, "id" | "name" | "season" | "status">;
};

/** Escape % and _ so an email is matched literally by ILIKE. */
function likeLiteral(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Registrations the logged-in user is a POC for (college_access or poc_email), newest season first.
 * Admins only get registrations they're personally a POC of, not everything.
 */
export const getMyRegistrations = cache(async (): Promise<MyRegistration[]> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const email = claims?.claims.email;
  if (!userId) return [];

  const [access, byEmail] = await Promise.all([
    supabase.from("college_access").select("registration_id").eq("user_id", userId),
    email
      ? supabase.from("registrations").select("id").ilike("poc_email", likeLiteral(email))
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);
  if (access.error) throw new Error(`getMyRegistrations: ${access.error.message}`);
  if (byEmail.error) throw new Error(`getMyRegistrations: ${byEmail.error.message}`);

  const ids = [...new Set([...(access.data ?? []).map((a) => a.registration_id), ...(byEmail.data ?? []).map((r) => r.id)])];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("registrations")
    .select("id, team_name, stage, status, colleges(name, city), leagues(id, name, season, status)")
    .in("id", ids);
  if (error) throw new Error(`getMyRegistrations: ${error.message}`);
  return data.sort((a, b) => b.leagues.season - a.leagues.season);
});
