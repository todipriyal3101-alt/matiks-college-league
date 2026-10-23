"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Constants } from "@/lib/database.types";
import { fromIstInput } from "@/lib/ist";
import { createClient } from "@/lib/supabase/server";

export type SeasonResult = { ok: true } | { ok: false; error: string };

const date = z.union([z.literal(""), z.iso.date()]).transform((v) => v || null);

const seasonSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Name is required").max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes, e.g. mcl-s2"),
    season: z.coerce.number().int().min(1).max(1000),
    startDate: date,
    endDate: date,
    deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)]).transform((v) => (v ? fromIstInput(v) : null)),
    maxColleges: z.union([z.literal(""), z.coerce.number().int().min(1).max(100_000)]).transform((v) => (v === "" ? null : v)),
    status: z.enum(Constants.public.Enums.league_status),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, { message: "End date is before the start date", path: ["endDate"] });

export type SeasonInput = z.input<typeof seasonSchema>;

/** Create or edit a season. Public pages cache the active league, so refresh that cache (CLAUDE.md rule 12). */
export async function saveSeason(input: SeasonInput): Promise<SeasonResult> {
  await requireAdminWriter();
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid season." };
  const v = parsed.data;
  const row = {
    name: v.name,
    slug: v.slug,
    season: v.season,
    start_date: v.startDate,
    end_date: v.endDate,
    registration_deadline: v.deadline,
    max_colleges: v.maxColleges,
    status: v.status,
  };
  const supabase = await createClient();
  const { error } = v.id
    ? await supabase.from("leagues").update(row).eq("id", v.id)
    : await supabase.from("leagues").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "That slug is already used by another season." : error.message };
  updateTag(CACHE_TAGS.league);
  refresh();
  return { ok: true };
}

/**
 * "Pause new registrations" (app_settings, migration 0006): the one emergency switch for POC self-registration,
 * which is otherwise always open. Admin writers only (also enforced by RLS).
 */
export async function setRegistrationsPaused(paused: boolean): Promise<SeasonResult> {
  await requireAdminWriter();
  if (typeof paused !== "boolean") return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").update({ registrations_paused: paused }).eq("id", true).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: "Only admins can change this." };
  refresh();
  return { ok: true };
}
