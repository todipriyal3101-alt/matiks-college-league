import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { emailEnabled, invitedEmail, sendEmail } from "@/lib/email";
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

export type InviteContext = { collegeName?: string; approved?: boolean };

/** One-time sign-in link built from generateLink's hashed token, landing on /auth/callback (works on any device). */
async function generateSignInLink(email: string, type: "invite" | "magiclink", next: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type, email, options: { redirectTo: callbackUrl(next) } });
  if (error || !data.user) return { ok: false as const, error: error?.message ?? "Couldn't create the link." };
  const link = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}&next=${encodeURIComponent(next)}`;
  return { ok: true as const, link, userId: data.user.id };
}

const homeFor = (role: AccessRole) => (role === "poc" ? "/college" : "/admin");

/**
 * Finds the user by email (find_user_id_by_email, service role only), or creates them with an invite email.
 * Never uses listUsers(), which only returns the first page.
 * With Resend set up, the invite is our own branded email (generateLink + Resend); without it, Supabase sends its
 * invite template.
 */
export async function findOrInviteUser(
  email: string,
  role: AccessRole,
  context: InviteContext = {},
): Promise<{ ok: true; userId: string; invited: boolean; emailed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const next = homeFor(role);
  const { data: existingId, error: lookupError } = await admin.rpc("find_user_id_by_email", { p_email: email });
  if (lookupError) {
    console.error("find_user_id_by_email:", lookupError.message);
    return { ok: false, error: "Couldn't look up that email. Please try again." };
  }

  // Existing account: the caller grants access, then calls emailAccessGranted().
  if (existingId) return { ok: true, userId: existingId, invited: false, emailed: false };

  if (emailEnabled()) {
    const link = await generateSignInLink(email, "invite", next);
    if (!link.ok) {
      console.error("generateLink(invite):", link.error);
      return { ok: false, error: link.error };
    }
    const sent = await sendEmail(invitedEmail(email, { ...context, role, link: link.link }));
    if (!sent.ok) return { ok: false, error: `The account was created but the email failed: ${sent.error} Use Resend on the Team page.` };
    return { ok: true, userId: link.userId, invited: true, emailed: true };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: callbackUrl(next) });
  if (error || !data.user) {
    console.error("inviteUserByEmail:", error?.message);
    return { ok: false, error: error?.message ?? "Couldn't send the invite." };
  }
  return { ok: true, userId: data.user.id, invited: true, emailed: true };
}

/** "You now have access" for someone who already had an account (Resend only; no-op without it). */
export async function emailAccessGranted(email: string, role: AccessRole, context: InviteContext = {}): Promise<boolean> {
  if (!emailEnabled()) return false;
  const link = `${siteUrl()}/login?next=${encodeURIComponent(homeFor(role))}`;
  return (await sendEmail(invitedEmail(email, { ...context, role, existingUser: true, link }))).ok;
}

/**
 * Re-sends a login email: a fresh invite if they never signed in, else a magic link.
 * With Resend: our own email with a generateLink link. Without: Supabase's templates, via a cookie-less anon
 * client so the admin's own session isn't touched.
 */
export async function resendAccessEmail(
  email: string,
  role: AccessRole,
  context: InviteContext = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = homeFor(role);
  const admin = createAdminClient();
  const userId = (await admin.rpc("find_user_id_by_email", { p_email: email })).data;
  const neverSignedIn = userId ? !(await admin.auth.admin.getUserById(userId)).data.user?.last_sign_in_at : false;

  if (emailEnabled() && userId) {
    // A magic link signs them in (and confirms an unaccepted invite); then they can set a password.
    const link = await generateSignInLink(email, "magiclink", next);
    if (link.ok) {
      const sent = await sendEmail(invitedEmail(email, { ...context, role, link: link.link }));
      if (sent.ok) return { ok: true };
      return { ok: false, error: sent.error ?? "Couldn't send the email." };
    }
    console.error("generateLink(magiclink):", link.error);
  }

  if (neverSignedIn) {
    // Never signed in: resend the invite (works while the invite is unaccepted).
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: callbackUrl(next) });
    if (!error) return { ok: true };
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
    // With Supabase captcha on, the server can't ask Supabase to send a login link (no browser, no token).
    if (/captcha/i.test(error.message)) {
      return { ok: false, error: "Set up Resend (RESEND_API_KEY) to resend login links, or ask them to use “Email me a login link” on /login." };
    }
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
