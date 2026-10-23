import type { Tables } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type CollegeSearchResult = Pick<
  Tables<"colleges">,
  "id" | "name" | "short_name" | "city" | "state" | "country"
>;

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

/**
 * Colleges whose name or short_name contains the query (case-insensitive), max 10.
 * Not cached, so a college added moments ago is found by the next student.
 */
export async function searchColleges(
  query: string,
): Promise<CollegeSearchResult[]> {
  // Strip characters that have meaning in PostgREST or()/ilike filters.
  const term = query.replace(/[,()%_\\*"]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < MIN_QUERY_LENGTH) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("colleges")
    .select("id, name, short_name, city, state, country")
    .or(`name.ilike.%${term}%,short_name.ilike.%${term}%`)
    .order("name")
    .limit(MAX_RESULTS);

  if (error) throw new Error(`searchColleges: ${error.message}`);
  return data;
}
