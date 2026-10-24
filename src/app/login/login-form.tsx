"use client";

import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNext } from "@/lib/safe-next";
import { signUpSchema } from "@/lib/validation/portal";
import { createClient } from "@/lib/supabase/client";

import { createAccount } from "./actions";

// Inlined at build time. Turn on once the Google provider is configured in Supabase.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true";

export type Mode = "password" | "forgot" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAPTCHA_FAILED = "Security check failed, please try again";

/** Supabase auth errors in plain words. */
function friendly(message: string) {
  if (/email rate limit/i.test(message)) return "We can't send more emails right now. Please try again in an hour.";
  if (/rate limit|security purposes|too many/i.test(message)) return "Too many tries. Wait a minute, then try again.";
  if (/invalid.*email|unable to validate email/i.test(message)) return "Enter a valid email address.";
  if (/captcha/i.test(message)) return CAPTCHA_FAILED;
  return message;
}

export function LoginForm({ next, initialMode = "password" }: { next?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState<"password" | "reset" | "google" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  // Cloudflare Turnstile, invisible: a fresh single-use token is fetched on each submit. Supabase checks it on sign-in
  // and password reset (Attack Protection › Captcha); sign-up checks it on our server.
  const turnstile = useRef<TurnstileHandle>(null);
  const continueUrl = `/auth/continue${next ? `?next=${encodeURIComponent(safeNext(next, "/"))}` : ""}`;
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(continueUrl)}`;

  /**
   * Runs one request: `invalid` (form checks, before spending a security check), then `fn` with the Turnstile token
   * (undefined when no captcha is configured, or for Google).
   */
  async function run(kind: NonNullable<typeof pending>, invalid: string | null, fn: (captcha: string | undefined) => Promise<string | null>) {
    setError(invalid);
    if (invalid) return;
    setPending(kind);
    let captcha: string | undefined;
    if (kind !== "google" && TURNSTILE_SITE_KEY) {
      const token = await turnstile.current?.getToken();
      if (!token) {
        setError(CAPTCHA_FAILED);
        setPending(null);
        return;
      }
      captcha = token;
    }
    setError(await fn(captcha));
    setPending(null);
  }

  const passwordLogin = () =>
    run("password", !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : !password ? "Enter your password." : null, async (captcha) => {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captcha } });
      if (error) return error.message === "Invalid login credentials" ? "Wrong email or password." : friendly(error.message);
      // Full navigation so src/proxy.ts and the role routing see the new session cookies.
      // Full page load on purpose: /auth/continue is a route handler redirect, and the new
      // session cookies must reach the proxy.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(continueUrl);
      return null;
    });

  const resetPassword = () =>
    run("reset", EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address.", async (captcha) => {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        captchaToken: captcha,
      });
      if (error) return friendly(error.message);
      // Same message whether or not the account exists, so this form can't be used to probe emails.
      setSent(`If ${email.trim()} has an account, we've sent a link to choose a new password. It works once and expires in 1 hour.`);
      return null;
    });

  // POCs create their own account (SPEC "Access"). No confirmation email: the server creates it confirmed and signs
  // them in (./actions.ts), so they go straight to the Register tab. Name and phone go into the auth metadata.
  const signUp = () => {
    const parsed = signUpSchema.safeParse({ name, phone, email, password });
    return run("signup", parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check the form."), async (captcha) => {
      const result = await createAccount({ name, phone, email, password }, captcha ?? "");
      if (!result.ok) return result.error;
      // Full load so the proxy sees the new session cookies; a co-lead link (?next=/j/CODE) continues there.
      window.location.assign(next ? continueUrl : "/college");
      return null;
    });
  };

  const google = () =>
    run("google", null, async () => {
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
      return error?.message ?? null;
    });

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-olive text-primary">
          <MailIcon className="size-5" />
        </div>
        <h2 className="text-3xl">Check your email</h2>
        <p className="text-sm text-muted-foreground">{sent}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setSent(null); setMode("password"); }}>
          <ArrowLeftIcon /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      // Our own checks show friendly inline messages instead of the browser's bubbles.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void (mode === "password" ? passwordLogin() : mode === "signup" ? signUp() : resetPassword());
      }}
    >
      <Turnstile ref={turnstile} action={mode === "signup" ? "signup" : mode === "forgot" ? "reset" : "login"} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        </Field>
        {mode === "signup" ? (
          <>
            <Field>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone (WhatsApp)</FieldLabel>
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 font-mono" />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">Password</FieldLabel>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-12" disabled={pending !== null}>
              {pending === "signup" && <Loader2Icon className="animate-spin" />}
              Create account
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setMode("password"); setError(null); }}>
              Already have an account? Sign in
            </Button>
          </>
        ) : mode === "password" ? (
          <>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
              <button
                type="button"
                className="self-end py-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                }}
              >
                Forgot password?
              </button>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-12" disabled={pending !== null}>
              {pending === "password" && <Loader2Icon className="animate-spin" />}
              Sign in
            </Button>
            {GOOGLE_LOGIN_ENABLED && <FieldSeparator>or</FieldSeparator>}
            {GOOGLE_LOGIN_ENABLED && (
              <Button type="button" variant="outline" className="h-12" disabled={pending !== null} onClick={google}>
                {pending === "google" && <Loader2Icon className="animate-spin" />}
                Continue with Google
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-11" onClick={() => { setMode("signup"); setError(null); }}>
              New college POC? <span className="text-primary">Create account</span>
            </Button>
          </>
        ) : (
          <>
            <FieldDescription>Enter your email and we&apos;ll send you a link to choose a new password.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-12" disabled={pending !== null}>
              {pending === "reset" && <Loader2Icon className="animate-spin" />}
              Send reset link
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setMode("password"); setError(null); }}>
              <ArrowLeftIcon /> Back to sign in
            </Button>
          </>
        )}
      </FieldGroup>
    </form>
  );
}
