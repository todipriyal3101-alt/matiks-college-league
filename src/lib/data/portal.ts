import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { OverviewRow } from "@/lib/data/league-ops";
import type { Stage } from "@/lib/league";
import { createClient } from "@/lib/supabase/server";
import { COUNTRIES, type Country } from "@/lib/validation/portal";

// Reads for the redesigned panels (migration 0005). The logged-in user's client, so RLS decides what comes back.

export const COUNTRY_COOKIE = "admin_country";

/** The admin's India / USA switch (remembered in a cookie). Filters every number and list. */
export const getAdminCountry = cache(async (): Promise<Country> => {
  const value = (await cookies()).get(COUNTRY_COOKIE)?.value;
  return (COUNTRIES as readonly string[]).includes(value ?? "") ? (value as Country) : "india";
});

/** Every registration of one country, all seasons (seasons are a background grouping now). Pending first, then newest. */
export async function getRegistrations(country: Country): Promise<OverviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registration_overview")
    .select("*")
    .eq("country", country)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getRegistrations: ${error.message}`);
  return data.sort((a, b) => Number(b.review_status === "pending") - Number(a.review_status === "pending"));
}

export type OverviewTotals = {
  colleges: number; // distinct colleges with a non-denied registration
  approved: number;
  registered: number; // every registration (the "All registered colleges" card)
  pending: number;
  live: number;
  ended: number;
  complete: number;
  amountBurnt: number; // prize money paid out, in this country's currency
  usersGained: number; // sum of participant counts (approved)
  prizePending: number;
};

/** Overview stat cards. Stages use the derived effective_stage (dates + payouts, admin override wins). */
export function overviewTotals(rows: OverviewRow[]): OverviewTotals {
  const approved = rows.filter((r) => r.review_status === "approved");
  const stageOf = (r: OverviewRow) => r.effective_stage as Stage | null;
  return {
    colleges: new Set(rows.filter((r) => r.review_status !== "rejected").map((r) => r.college_id)).size,
    approved: approved.length,
    registered: rows.length,
    pending: rows.filter((r) => r.review_status === "pending").length,
    live: approved.filter((r) => stageOf(r) === "live").length,
    ended: approved.filter((r) => stageOf(r) === "ended_prize_pending" || stageOf(r) === "ended_prize_sent").length,
    complete: approved.filter((r) => stageOf(r) === "ended_prize_sent").length,
    amountBurnt: rows.reduce((sum, r) => sum + (r.prize_paid_amount ?? 0), 0),
    usersGained: approved.reduce((sum, r) => sum + (r.participant_count ?? 0), 0),
    prizePending: approved.filter((r) => stageOf(r) === "ended_prize_pending").length,
  };
}

/** One registration's overview row (POC: own only; admins: any). */
export async function getOverviewRow(registrationId: string): Promise<OverviewRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("registration_overview").select("*").eq("registration_id", registrationId).maybeSingle();
  if (error) throw new Error(`getOverviewRow: ${error.message}`);
  return data;
}

export type PocRow = {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  role: string;
  college: string;
  country: Country;
  reviewStatus: string;
  league: string;
};

/** Every POC contact (primary first) of one country, for the POCs page. Admin RLS. */
export async function getPocs(country: Country): Promise<PocRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, registration_id, name, email, phone, is_primary, role, registrations!inner(status, leagues(name), colleges!inner(name, country))")
    .eq("registrations.colleges.country", country)
    .order("is_primary", { ascending: false })
    .order("name");
  if (error) throw new Error(`getPocs: ${error.message}`);
  return data
    .map((c) => ({
      id: c.id,
      registrationId: c.registration_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      isPrimary: c.is_primary,
      role: c.role,
      college: c.registrations.colleges.name,
      country: c.registrations.colleges.country,
      reviewStatus: c.registrations.status,
      league: c.registrations.leagues.name,
    }))
    .sort((a, b) => a.college.localeCompare(b.college) || Number(b.isPrimary) - Number(a.isPrimary));
}

/**
 * The admin's emergency switch (app_settings, migration 0006). Uncached: the Register tab and the register action
 * must see a change at once. POC self-registration is otherwise always open (no season switch or deadline).
 */
export async function getRegistrationsPaused(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("registrations_paused").maybeSingle();
  if (error) throw new Error(`getRegistrationsPaused: ${error.message}`);
  return data?.registrations_paused ?? false;
}
