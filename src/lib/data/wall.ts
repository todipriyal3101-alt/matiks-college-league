import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type WallCollege = Database["public"]["Functions"]["public_approved_colleges"]["Returns"][number];

/**
 * Approved colleges of a league for the public /colleges wall: public fields only (public_approved_colleges,
 * migration 0004). Tagged so approving, deleting or merging shows at once.
 */
export async function getApprovedColleges(leagueId: string): Promise<WallCollege[]> {
  "use cache";
  cacheTag(CACHE_TAGS.colleges);
  cacheLife("hours");
  const { data, error } = await createPublicClient().rpc("public_approved_colleges", { p_league_id: leagueId });
  if (error) throw new Error(`getApprovedColleges: ${error.message}`);
  return data;
}
