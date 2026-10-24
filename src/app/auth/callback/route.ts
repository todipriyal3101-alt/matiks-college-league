import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthLinkError } from "@/lib/auth/link-error";
import { safeNext } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["invite", "magiclink", "recovery", "email", "signup", "email_change"];

/**
 * Lands every auth link and finishes the login, then redirects:
 * - `code` (PKCE: Google, or a link requested from this same browser)
 * - `token_hash` + `type` (password reset emails, and older invite / magic links; works on any device)
 * Password recovery goes to /reset-password; everything else to `next` or /auth/continue (routes by role).
 * Supabase's own error params (?error_code=otp_expired: the link expired or was used) go to /login with a message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: { message: string } | null = null;
  if (isAuthLinkError(searchParams)) {
    error = { message: `${searchParams.get("error_code") ?? searchParams.get("error")}: ${searchParams.get("error_description") ?? ""}` };
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: "missing code" };
  }

  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"), "/auth/continue");
  if (error) {
    console.error("auth/callback:", error.message);
    // A dead reset link goes back to "Forgot password" with its own message. A link opened in another
    // browser than the one that asked for it (PKCE) isn't expired: say so.
    const reason = /code verifier/i.test(error.message)
      ? "other_browser"
      : next === "/reset-password"
        ? "reset_expired"
        : "link_expired";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  }

  await markVerified(supabase, tokenHash ? "link" : null);
  return NextResponse.redirect(new URL(next, origin));
}

/**
 * Opening an emailed link (password reset) proves the person owns the email; so does Google. "Confirm email" is off
 * (0009), so this is how an account loses the admins' "Email not verified" flag. Written with the service role.
 */
async function markVerified(supabase: Awaited<ReturnType<typeof createClient>>, method: "link" | null) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const how = method ?? (user.app_metadata?.providers?.includes("google") || user.app_metadata?.provider === "google" ? "google" : null);
  if (!how) return;
  const { error } = await createAdminClient().from("verified_accounts").upsert({ user_id: user.id, method: how }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) console.error("verified_accounts:", error.message);
}
