"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fromIstInput } from "@/lib/ist";
import { createClient } from "@/lib/supabase/server";

export type MatchResult = { ok: true } | { ok: false; error: string };

const score = z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]).transform((v) => (v === "" ? null : v));

const matchSchema = z
  .object({
    id: z.uuid().optional(),
    leagueId: z.uuid(),
    round: z.string().trim().min(1, "Round is required").max(60),
    collegeAId: z.uuid("Pick college A"),
    collegeBId: z.uuid("Pick college B"),
    scheduledAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)]).transform((v) => (v ? fromIstInput(v) : null)),
    scoreA: score,
    scoreB: score,
    winner: z.enum(["a", "b", "none"]),
  })
  .refine((v) => v.collegeAId !== v.collegeBId, { message: "A college can't play itself", path: ["collegeBId"] });

export type MatchInput = z.input<typeof matchSchema>;

export async function saveMatch(input: MatchInput): Promise<MatchResult> {
  await requireAdminWriter();
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid match." };
  const v = parsed.data;
  const row = {
    league_id: v.leagueId,
    round: v.round,
    college_a_id: v.collegeAId,
    college_b_id: v.collegeBId,
    scheduled_at: v.scheduledAt,
    score_a: v.scoreA,
    score_b: v.scoreB,
    winner_id: v.winner === "a" ? v.collegeAId : v.winner === "b" ? v.collegeBId : null,
  };
  const supabase = await createClient();
  const { error } = v.id ? await supabase.from("matches").update(row).eq("id", v.id) : await supabase.from("matches").insert(row);
  if (error) return { ok: false, error: error.message };
  updateTag(CACHE_TAGS.matches);
  refresh();
  return { ok: true };
}

export async function deleteMatch(id: string): Promise<MatchResult> {
  await requireAdminWriter();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  updateTag(CACHE_TAGS.matches);
  refresh();
  return { ok: true };
}
