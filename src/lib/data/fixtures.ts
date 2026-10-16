import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

export type Fixture = {
  id: string;
  round: string;
  scheduled_at: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  a: { id: string; name: string; short_name: string | null };
  b: { id: string; name: string; short_name: string | null };
};

/** Public fixtures of a league (matches and college names are public). Tagged so admin edits show at once. */
export async function getFixtures(leagueId: string): Promise<Fixture[]> {
  "use cache";
  cacheTag(CACHE_TAGS.matches);
  cacheLife("hours");
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, round, scheduled_at, score_a, score_b, winner_id, a:colleges!matches_college_a_id_fkey(id, name, short_name), b:colleges!matches_college_b_id_fkey(id, name, short_name)",
    )
    .eq("league_id", leagueId)
    .order("scheduled_at", { nullsFirst: false });
  if (error) throw new Error(`getFixtures: ${error.message}`);
  return data;
}
