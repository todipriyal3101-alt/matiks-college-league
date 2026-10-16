"use server";

import { randomInt } from "node:crypto";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export type AmbassadorResult = { ok: true; code: string } | { ok: false; error: string };

const optional = (schema: z.ZodType<string>) => z.union([z.literal(""), schema]).transform((v) => v || null);

const ambassadorSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Name is required").max(80),
  email: optional(z.email("Enter a valid email").trim().toLowerCase()),
  phone: optional(z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, "10-digit Indian mobile")),
  collegeId: z.uuid().nullable(),
  /** Empty = generate one. */
  referralCode: optional(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, "4–20 letters or digits")),
});

export type AmbassadorInput = z.input<typeof ambassadorSchema>;

/** Short, readable, unambiguous code from the name: "PRIYA" + 3 digits, e.g. PRIYA482. */
function generateCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "MATIKS";
  return `${base}${randomInt(100, 1000)}`;
}

export async function saveAmbassador(input: AmbassadorInput): Promise<AmbassadorResult> {
  await requireAdminWriter();
  const parsed = ambassadorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ambassador." };
  const v = parsed.data;
  const supabase = await createClient();
  const row = { name: v.name, email: v.email, phone: v.phone, college_id: v.collegeId };

  if (v.id) {
    const { data, error } = await supabase
      .from("ambassadors")
      .update({ ...row, ...(v.referralCode ? { referral_code: v.referralCode } : {}) })
      .eq("id", v.id)
      .select("referral_code")
      .single();
    if (error) return { ok: false, error: error.code === "23505" ? "That referral code is taken." : error.message };
    refresh();
    return { ok: true, code: data.referral_code };
  }

  // Generated codes can collide with an existing one (unique constraint): retry a few times.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = v.referralCode ?? generateCode(v.name);
    const { error } = await supabase.from("ambassadors").insert({ ...row, referral_code: code });
    if (!error) {
      refresh();
      return { ok: true, code };
    }
    if (error.code !== "23505") return { ok: false, error: error.message };
    if (v.referralCode) return { ok: false, error: "That referral code is taken." };
  }
  return { ok: false, error: "Couldn't generate a free code. Type one instead." };
}

export async function setAmbassadorActive(id: string, active: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminWriter();
  if (!z.uuid().safeParse(id).success || typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("ambassadors").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
