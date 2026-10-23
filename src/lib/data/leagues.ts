import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Tables } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type League = Tables<"leagues">;

async function fetchActiveLeague(): Promise<League | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .in("status", ["upcoming", "live"])
    .order("season", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getActiveLeague: ${error.message}`);
  return data;
}

/**
 * The most recent league with status 'upcoming' or 'live', for display.
 * Cached and tagged "league": admin actions that change a league must call
 * updateTag(CACHE_TAGS.league) so the change shows immediately.
 */
export async function getActiveLeague(): Promise<League | null> {
  "use cache";
  cacheTag(CACHE_TAGS.league);
  cacheLife("hours");
  return fetchActiveLeague();
}
