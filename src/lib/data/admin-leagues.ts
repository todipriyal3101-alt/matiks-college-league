import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_LEAGUE_COOKIE = "admin_league";

export type AdminLeague = Pick<
  Tables<"leagues">,
  "id" | "name" | "season" | "status" | "registration_open"
>;

/** Every league including drafts (admin RLS), newest season first. Read once per request. */
export const getAdminLeagues = cache(async (): Promise<AdminLeague[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, season, status, registration_open")
    .order("season", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getAdminLeagues: ${error.message}`);
  return data;
});

/**
 * The season chosen in the admin season picker (admin_league cookie).
 * Falls back to the active league (upcoming/live), then the newest league.
 */
export const getSelectedLeague = cache(async (): Promise<AdminLeague | null> => {
  const [leagues, cookieStore] = await Promise.all([getAdminLeagues(), cookies()]);
  const selectedId = cookieStore.get(ADMIN_LEAGUE_COOKIE)?.value;
  return (
    leagues.find((l) => l.id === selectedId) ??
    leagues.find((l) => l.status === "upcoming" || l.status === "live") ??
    leagues[0] ??
    null
  );
});
