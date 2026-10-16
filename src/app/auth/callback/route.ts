import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["invite", "magiclink", "recovery", "email", "signup", "email_change"];

/**
 * Lands every auth link and finishes the login, then redirects:
 * - `code` (PKCE: Google, or a link requested from this same browser)
 * - `token_hash` + `type` (invite / magic link / password reset emails; works on any device)
 * Password recovery goes to /reset-password; everything else to `next` or /auth/continue (routes by role).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: { message: string } | null = null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: "missing code" };
  }

  if (error) {
    console.error("auth/callback:", error.message);
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"), "/auth/continue");
  return NextResponse.redirect(new URL(next, origin));
}
