"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { accessMessage, addPocAccess, findUserId } from "@/lib/auth/invite";
import { createClient } from "@/lib/supabase/server";

export type TeamResult = { ok: true; message: string; whatsapp?: string } | { ok: false; error: string; whatsapp?: string };

const inviteSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.enum(["admin", "viewer"]),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    name: z.string().trim().max(80).optional(),
  }),
  z.object({
    role: z.literal("poc"),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    registrationId: z.uuid("Pick a college"),
  }),
]);

export type InviteInput = z.input<typeof inviteSchema>;

/**
 * Give an Admin / Viewer / College POC access. No emails (0009): existing accounts get access at once. A POC without
 * an account gets a pending entry + a WhatsApp message to share. Admins and viewers must sign up first (an unverified
 * email must never become an admin automatically).
 */
export async function inviteAccess(input: InviteInput): Promise<TeamResult> {
  const { profile } = await requireAdminWriter();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const data = parsed.data;

  if (data.role === "poc") {
    const supabase = await createClient();
    const { data: reg } = await supabase.from("registrations").select("colleges(name)").eq("id", data.registrationId).maybeSingle();
    if (!reg) return { ok: false, error: "College not found." };
    const res = await addPocAccess({ email: data.email, registrationId: data.registrationId, invitedBy: profile.user_id, collegeName: reg.colleges.name });
    if (!res.ok) return res;
    refresh();
    return res.status === "pending" ? { ok: true, message: res.message, whatsapp: res.whatsapp } : { ok: true, message: res.message };
  }

  if (data.email === profile.email.toLowerCase()) return { ok: false, error: "You can't change your own role." };
  const found = await findUserId(data.email);
  if (!found.ok) return found;
  if (!found.userId) {
    return {
      ok: false,
      error: `${data.email} has no account yet. Ask them to create one at /login, then add them here.`,
      whatsapp: accessMessage({ email: data.email, name: data.name, role: data.role }),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_profiles")
    .upsert({ user_id: found.userId, email: data.email, name: data.name || null, role: data.role }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `${data.email} is now ${data.role === "admin" ? "an admin" : "a viewer"}. They sign in at /login.` };
}

/** Withdraw a pending POC entry (before they sign up). */
export async function revokePendingAccess(id: string): Promise<TeamResult> {
  await requireAdminWriter();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pending_access").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("claimed_at", null).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: "Already used or removed." };
  refresh();
  return { ok: true, message: "Pending access removed." };
}

/** Remove admin/viewer access, or one college's POC access. Never yourself. */
export async function revokeAccess(
  input: { kind: "admin"; userId: string } | { kind: "poc"; userId: string; registrationId: string },
): Promise<TeamResult> {
  const { profile } = await requireAdminWriter();
  const parsed = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("admin"), userId: z.uuid() }),
      z.object({ kind: z.literal("poc"), userId: z.uuid(), registrationId: z.uuid() }),
    ])
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (parsed.data.kind === "admin" && parsed.data.userId === profile.user_id) {
    return { ok: false, error: "You can't revoke your own access." };
  }

  const supabase = await createClient();
  const { error } =
    parsed.data.kind === "admin"
      ? await supabase.from("admin_profiles").delete().eq("user_id", parsed.data.userId)
      : await supabase
          .from("college_access")
          .delete()
          .eq("user_id", parsed.data.userId)
          .eq("registration_id", parsed.data.registrationId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Access revoked." };
}
