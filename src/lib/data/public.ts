import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import type { Country } from "@/lib/validation/portal";

// Public launch data, read through the anon client and the 0007 public_* functions (public columns only: never a
// POC's email, phone or full name). Race and home numbers are cached a few minutes and refreshed on review changes.

export async function getHomeStats() {
  "use cache";
  cacheTag(CACHE_TAGS.race, CACHE_TAGS.colleges);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("public_home_stats");
  if (error) throw new Error(`public_home_stats: ${error.message}`);
  return data[0] ?? { colleges: 0, players: 0, next_league_start: null, season: null };
}

export type RaceRow = Awaited<ReturnType<typeof getCollegeRace>>[number];

export async function getCollegeRace(country: Country) {
  "use cache";
  cacheTag(CACHE_TAGS.race, CACHE_TAGS.colleges);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("public_college_race", { p_country: country });
  if (error) throw new Error(`public_college_race: ${error.message}`);
  return [...data].sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
}

export async function getStateCounts(country: Country) {
  "use cache";
  cacheTag(CACHE_TAGS.race, CACHE_TAGS.colleges);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("public_state_counts", { p_country: country });
  if (error) throw new Error(`public_state_counts: ${error.message}`);
  return data;
}

export async function getTopToday(limit = 10) {
  "use cache";
  cacheTag(CACHE_TAGS.duels);
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  const { data, error } = await createPublicClient().rpc("top_duels_today", { p_limit: limit });
  if (error) throw new Error(`top_duels_today: ${error.message}`);
  return data;
}

export async function getPublicCollege(slug: string) {
  "use cache";
  cacheTag(CACHE_TAGS.race, CACHE_TAGS.colleges);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().rpc("public_college", { p_slug: slug });
  if (error) throw new Error(`public_college: ${error.message}`);
  return data[0] ?? null;
}

/** Always fresh (hiding a certificate must take effect at once). */
export async function getPublicCertificate(id: string) {
  const { data, error } = await createPublicClient().rpc("public_certificate", { p_id: id });
  if (error) throw new Error(`public_certificate: ${error.message}`);
  return data[0] ?? null;
}

export async function getPublicInvite(code: string) {
  const { data, error } = await createPublicClient().rpc("public_invite", { p_code: code });
  if (error) throw new Error(`public_invite: ${error.message}`);
  return data[0] ?? null;
}
