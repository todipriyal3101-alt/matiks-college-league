"use server";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema, type SignUpInput } from "@/lib/validation/portal";

// Sign-up without a confirmation email, whatever Supabase's "Confirm email" setting says: the server checks the
// captcha itself, creates the account already confirmed (service role) and signs the person in. Admins still see
// "Email not verified" until they open a reset link or use Google (verified_accounts, 0009).

export type SignUpResult = { ok: true } | { ok: false; error: string };

export async function createAccount(input: SignUpInput, captchaToken: string): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, phone, email, password } = parsed.data;

  if (!(await captchaOk(captchaToken))) return { ok: false, error: "The security check failed or expired. Please try again." };

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone } });
  if (createError) {
    if (createError.code === "email_exists" || /already (been )?registered/i.test(createError.message)) {
      return { ok: false, error: "This email already has an account. Sign in instead." };
    }
    console.error("createAccount:", createError.message);
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }

  // Sign in on this response: a one-time token minted by the server (nothing is emailed), exchanged for the
  // session cookies. Supabase's captcha isn't asked again; the check above covered this request.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const { error: sessionError } = linkError
    ? { error: linkError }
    : await (await createClient()).auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (sessionError) {
    console.error("createAccount sign-in:", sessionError.message);
    return { ok: false, error: "Your account was created, but we couldn't sign you in. Sign in with your email and password." };
  }
  return { ok: true };
}

/** Cloudflare Turnstile, checked here because Supabase only checks it on its own sign-up endpoint. */
async function captchaOk(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; // no captcha configured (local dev)
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success: boolean; action?: string; "error-codes"?: string[] };
    if (!data.success) console.error("turnstile:", data["error-codes"]?.join(", "));
    return data.success && (!data.action || data.action === "signup");
  } catch (e) {
    console.error("turnstile:", e);
    return false;
  }
}
