"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";

/** Hide (or show) a "Top today" entry. Admin writers only (also RLS + column grant). */
export async function setDuelHidden(roundId: string, hidden: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminWriter();
  if (!z.uuid().safeParse(roundId).success || typeof hidden !== "boolean") return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("duel_rounds").update({ hidden }).eq("id", roundId).select("id");
  if (error || !data.length) return { ok: false, error: error?.message ?? "Not found." };
  updateTag(CACHE_TAGS.duels);
  refresh();
  return { ok: true };
}
