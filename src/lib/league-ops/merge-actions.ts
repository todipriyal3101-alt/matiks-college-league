"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { getAdmin } from "@/lib/auth/admin";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// "Merge into…" on the college editor (docs/SPEC.md "League operations > Duplicate colleges").
// The merge itself is merge_colleges() (migration 0004): one transaction, service_role only,
// so it is called here after the admin-writer check.

export type MergeResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type MergePreview = {
  keep: { id: string; name: string; city: string | null; state: string | null };
  duplicate: { id: string; name: string };
  /** Season names of the duplicate's registrations that move. */
  registrations: string[];
  matches: number;
  ambassadors: number;
  /** Why the merge would be refused, if it would be. */
  blocked: string | null;
};

const pair = z
  .object({ keepId: z.uuid(), duplicateId: z.uuid() })
  .refine((v) => v.keepId !== v.duplicateId, { message: "Pick a different college to keep." });

async function writer(): Promise<string | null> {
  const admin = await getAdmin();
  return admin?.isWriter ? null : "Only admins can merge colleges.";
}

/** What a merge would move, read with the admin's own session. */
export async function previewMerge(keepId: string, duplicateId: string): Promise<MergeResult<{ preview: MergePreview }>> {
  const denied = await writer();
  if (denied) return { ok: false, error: denied };
  const parsed = pair.safeParse({ keepId, duplicateId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { keepId: k, duplicateId: d } = parsed.data;

  const supabase = await createClient();
  const [colleges, regs, matches, headToHead, ambassadors] = await Promise.all([
    supabase.from("colleges").select("id, name, city, state").in("id", [k, d]),
    supabase.from("registrations").select("college_id, league_id, leagues(name, season)").in("college_id", [k, d]),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`college_a_id.eq.${d},college_b_id.eq.${d},winner_id.eq.${d}`),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`and(college_a_id.eq.${k},college_b_id.eq.${d}),and(college_a_id.eq.${d},college_b_id.eq.${k})`),
    supabase.from("ambassadors").select("id", { count: "exact", head: true }).eq("college_id", d),
  ]);
  const failed = [colleges, regs, matches, headToHead, ambassadors].find((r) => r.error);
  if (failed?.error) {
    console.error("previewMerge:", failed.error.message);
    return { ok: false, error: "Couldn't load the merge preview." };
  }

  const keep = colleges.data!.find((c) => c.id === k);
  const duplicate = colleges.data!.find((c) => c.id === d);
  if (!keep || !duplicate) return { ok: false, error: "College not found." };

  const dupRegs = regs.data!.filter((r) => r.college_id === d).sort((a, b) => a.leagues.season - b.leagues.season);
  const keepLeagues = new Set(regs.data!.filter((r) => r.college_id === k).map((r) => r.league_id));
  const shared = dupRegs.filter((r) => keepLeagues.has(r.league_id)).map((r) => r.leagues.name);

  const blocked = shared.length
    ? `Both colleges are registered for ${shared.join(", ")}. Delete or keep only one of those registrations first.`
    : headToHead.count
      ? "These colleges have a match against each other. Delete that match first."
      : null;

  return {
    ok: true,
    preview: {
      keep,
      duplicate: { id: duplicate.id, name: duplicate.name },
      registrations: dupRegs.map((r) => r.leagues.name),
      matches: matches.count ?? 0,
      ambassadors: ambassadors.count ?? 0,
      blocked,
    },
  };
}

/** Merge the duplicate into the kept college. The registration being edited keeps its id; it now belongs to the kept college. */
export async function mergeColleges(keepId: string, duplicateId: string): Promise<MergeResult<{ message: string }>> {
  const denied = await writer();
  if (denied) return { ok: false, error: denied };
  const parsed = pair.safeParse({ keepId, duplicateId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const { data, error } = await createAdminClient().rpc("merge_colleges", {
    p_keep: parsed.data.keepId,
    p_duplicate: parsed.data.duplicateId,
  });
  if (error) {
    // P0001/P0002 are raised by merge_colleges with messages written for people.
    if (error.code === "P0001" || error.code === "P0002") return { ok: false, error: error.message };
    console.error("mergeColleges:", error.code, error.message);
    return { ok: false, error: "Couldn't merge. Nothing was changed." };
  }

  const result = data as { kept: string; removed: string };
  updateTag(CACHE_TAGS.matches);
  updateTag(CACHE_TAGS.colleges);
  refresh();
  return { ok: true, message: `Merged ${result.removed} into ${result.kept}.` };
}
