import "server-only";

import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Giving people access (SPEC "League operations > Access"). Server only: uses the service role to look people up.
// No emails (migration 0009, "Confirm email" off): an existing account gets access at once; otherwise a pending
// entry waits for someone to sign up with that exact email (14 days), and the admin shares a WhatsApp message.

export type AccessRole = "admin" | "viewer" | "poc";

/** The account id for an email (find_user_id_by_email, service role only), or null. Never listUsers(). */
export async function findUserId(email: string): Promise<{ ok: true; userId: string | null } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient().rpc("find_user_id_by_email", { p_email: email });
  if (error) {
    console.error("find_user_id_by_email:", error.message);
    return { ok: false, error: "Couldn't look up that email. Please try again." };
  }
  return { ok: true, userId: data ?? null };
}

/** "Hi Ravi, sign up at …/login with ravi@college.edu to manage IIT Guwahati…" for the admin to paste in WhatsApp. */
export function accessMessage(d: { email: string; name?: string | null; collegeName?: string; role: AccessRole }) {
  const first = d.name?.trim().split(/\s+/)[0];
  const url = `${siteUrl}/login?mode=signup`;
  const what = d.role === "poc" ? `to manage ${d.collegeName ?? "your college"} in the Matiks College League` : "for the Matiks College League admin panel";
  return d.role === "poc"
    ? `Hi${first ? ` ${first}` : ""}, sign up at ${url} with ${d.email} ${what}. You'll get access as soon as you create your account.`
    : `Hi${first ? ` ${first}` : ""}, create an account at ${url} with ${d.email} ${what}, then tell me so I can add you.`;
}

export type PocAccessResult =
  | { ok: true; status: "granted"; message: string }
  | { ok: true; status: "pending"; message: string; whatsapp: string }
  | { ok: false; error: string };

/**
 * Gives `email` POC access to one registration. Existing account → college_access now. No account → a pending entry
 * (claimed when they sign up with that exact email). Writes use the admin's own session (RLS: writers only).
 */
export async function addPocAccess(d: {
  email: string;
  registrationId: string;
  invitedBy: string;
  collegeName: string;
  name?: string | null;
}): Promise<PocAccessResult> {
  const found = await findUserId(d.email);
  if (!found.ok) return found;
  const supabase = await createClient();
  if (found.userId) {
    const { error } = await supabase
      .from("college_access")
      .upsert({ user_id: found.userId, registration_id: d.registrationId, invited_by: d.invitedBy }, { onConflict: "user_id,registration_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, status: "granted", message: `${d.email} can now manage ${d.collegeName}.` };
  }
  // One open entry per email and college: renew it rather than stacking duplicates.
  const { data: open } = await supabase
    .from("pending_access")
    .select("id")
    .eq("registration_id", d.registrationId)
    .eq("email", d.email)
    .is("claimed_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { error } = open
    ? await supabase.from("pending_access").update({ expires_at: expires }).eq("id", open.id)
    : await supabase.from("pending_access").insert({ email: d.email, registration_id: d.registrationId, invited_by: d.invitedBy });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    status: "pending",
    message: `${d.email} has no account yet. They get access when they sign up with that email (within 14 days).`,
    whatsapp: accessMessage({ email: d.email, name: d.name, collegeName: d.collegeName, role: "poc" }),
  };
}
