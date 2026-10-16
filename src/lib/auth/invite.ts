import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Inviting people (SPEC "League operations > Access"). Server only: uses the service role.

export type AccessRole = "admin" | "viewer" | "poc";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Where an invite / login link lands. /auth/continue then routes by role. */
export function callbackUrl(next: string) {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Finds the user by email (find_user_id_by_email, service role only), or creates them with an invite email.
 * Never uses listUsers(), which only returns the first page.
 */
export async function findOrInviteUser(
  email: string,
  role: AccessRole,
): Promise<{ ok: true; userId: string; invited: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: existingId, error: lookupError } = await admin.rpc("find_user_id_by_email", { p_email: email });
  if (lookupError) {
    console.error("find_user_id_by_email:", lookupError.message);
    return { ok: false, error: "Couldn't look up that email. Please try again." };
  }
  if (existingId) return { ok: true, userId: existingId, invited: false };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: callbackUrl(role === "poc" ? "/college" : "/admin"),
  });
  if (error || !data.user) {
    console.error("inviteUserByEmail:", error?.message);
    return { ok: false, error: error?.message ?? "Couldn't send the invite." };
  }
  return { ok: true, userId: data.user.id, invited: true };
}

/**
 * Re-sends a login email: a fresh invite if they never accepted, else a magic link.
 * Uses a cookie-less anon client so the admin's own session isn't touched.
 */
export async function resendAccessEmail(email: string, role: AccessRole): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = role === "poc" ? "/college" : "/admin";
  const admin = createAdminClient();
  const userId = (await admin.rpc("find_user_id_by_email", { p_email: email })).data;
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user && !data.user.last_sign_in_at) {
      // Never signed in: resend the invite (works while the invite is unaccepted).
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: callbackUrl(next) });
      if (!error) return { ok: true };
    }
  }
  const anon = createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(next) },
  });
  if (error) {
    console.error("resendAccessEmail:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Gives a user POC access to one registration (idempotent). Uses the admin's own session (RLS: writers only). */
export async function grantPocAccess(userId: string, registrationId: string, invitedBy: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("college_access")
    .upsert({ user_id: userId, registration_id: registrationId, invited_by: invitedBy }, { onConflict: "user_id,registration_id" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
