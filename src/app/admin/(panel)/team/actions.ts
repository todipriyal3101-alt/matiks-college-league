"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireAdminWriter } from "@/lib/auth/admin";
import { emailAccessGranted, findOrInviteUser, grantPocAccess, resendAccessEmail } from "@/lib/auth/invite";
import { createClient } from "@/lib/supabase/server";

export type TeamResult = { ok: true; message: string } | { ok: false; error: string };

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

/** Invite an Admin / Viewer / College POC. Existing users just get access; new users get an invite email. */
export async function inviteAccess(input: InviteInput): Promise<TeamResult> {
  const { profile } = await requireAdminWriter();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const data = parsed.data;

  if (data.role !== "poc" && data.email === profile.email.toLowerCase()) {
    return { ok: false, error: "You can't change your own role." };
  }

  let collegeName: string | undefined;
  if (data.role === "poc") {
    const supabase = await createClient();
    const { data: reg } = await supabase.from("registrations").select("colleges(name)").eq("id", data.registrationId).maybeSingle();
    if (!reg) return { ok: false, error: "College not found." };
    collegeName = reg.colleges.name;
  }

  const user = await findOrInviteUser(data.email, data.role, { collegeName });
  if (!user.ok) return user;

  if (data.role === "poc") {
    const granted = await grantPocAccess(user.userId, data.registrationId, profile.user_id);
    if (!granted.ok) return { ok: false, error: granted.error };
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from("admin_profiles")
      .upsert({ user_id: user.userId, email: data.email, name: data.name || null, role: data.role }, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };
  }

  const emailed = !user.invited && (await emailAccessGranted(data.email, data.role, { collegeName }));
  refresh();
  return {
    ok: true,
    message: user.invited
      ? `Invite sent to ${data.email}.`
      : `${data.email} already has an account: access granted${emailed ? " and emailed" : ""}. They can sign in at /login.`,
  };
}

/** Resend the invite (never signed in) or a login link. */
export async function resendInvite(email: string, role: "admin" | "viewer" | "poc"): Promise<TeamResult> {
  await requireAdminWriter();
  const parsed = z.object({ email: z.email(), role: z.enum(["admin", "viewer", "poc"]) }).safeParse({ email, role });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const res = await resendAccessEmail(parsed.data.email, parsed.data.role);
  return res.ok ? { ok: true, message: `Email sent to ${parsed.data.email}.` } : res;
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
