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

// Inlined at build time. Turn on once the Google provider is configured in Supabase.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true";

export type Mode = "password" | "forgot" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase auth errors in plain words. */
function friendly(message: string) {
  if (/email rate limit/i.test(message)) return "We can't send more emails right now. Please try again in an hour.";
  if (/rate limit|security purposes|too many/i.test(message)) return "Too many tries. Wait a minute, then try again.";
  if (/invalid.*email|unable to validate email/i.test(message)) return "Enter a valid email address.";
  if (/captcha/i.test(message)) return "The security check failed or expired. Please try again.";
  return message;
}

export function LoginForm({ next, initialMode = "password" }: { next?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState<"password" | "magic" | "reset" | "google" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  // Cloudflare Turnstile: Supabase checks this token on sign-in, sign-up, magic link and password reset
  // (Attack Protection › Captcha). Tokens are single-use, so the widget is reset after every request that used one.
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  const tokenUsed = useRef(false);
  const captcha = () => {
    tokenUsed.current = true;
    return captchaToken || undefined;
  };
  const continueUrl = `/auth/continue${next ? `?next=${encodeURIComponent(safeNext(next, "/"))}` : ""}`;
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(continueUrl)}`;

  async function run(kind: NonNullable<typeof pending>, fn: () => Promise<string | null>) {
    if (kind !== "google" && TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Wait a moment for the security check to finish, then try again.");
      return;
    }
    setPending(kind);
    setError(null);
    tokenUsed.current = false;
    setError(await fn());
    if (tokenUsed.current) turnstile.current?.reset();
    setPending(null);
  }

  const widget = <Turnstile ref={turnstile} onToken={setCaptchaToken} action={mode === "signup" ? "signup" : mode === "forgot" ? "reset" : "login"} />;

  const passwordLogin = () =>
    run("password", async () => {
      if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
      if (!password) return "Enter your password.";
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captcha() } });
      if (error) return error.message === "Invalid login credentials" ? "Wrong email or password." : friendly(error.message);
      // Full navigation so src/proxy.ts and the role routing see the new session cookies.
      // Full page load on purpose: /auth/continue is a route handler redirect, and the new
      // session cookies must reach the proxy.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(continueUrl);
      return null;
    });

  const magicLink = () =>
    run("magic", async () => {
      if (!email.trim()) return "Enter your email first.";
      if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: callback(), captchaToken: captcha() },
      });
      if (error) {
        return /signups not allowed|not found/i.test(error.message)
          ? "There's no account for this email yet. Create one below."
          : friendly(error.message);
      }
      setSent(`We've emailed a login link to ${email.trim()}. Open it on any device.`);
      return null;
    });

  const resetPassword = () =>
    run("reset", async () => {
      if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        captchaToken: captcha(),
      });
      if (error) return friendly(error.message);
      // Same message whether or not the account exists, so this form can't be used to probe emails.
      setSent(`If ${email.trim()} has an account, we've sent a link to choose a new password. It works once and expires in 1 hour.`);
      return null;
    });

  // POCs create their own account (SPEC "Access"); email confirmation is on, so they confirm first.
  // Name and phone go into the auth metadata; the Register tab uses them for the primary contact.
  const signUp = () =>
    run("signup", async () => {
      const parsed = signUpSchema.safeParse({ name, phone, email, password });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check the form.";
      const { data, error } = await createClient().auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { name: parsed.data.name, phone: parsed.data.phone },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/college")}`,
          captchaToken: captcha(),
        },
      });
      if (error) return /already registered/i.test(error.message) ? "This email already has an account. Sign in instead." : friendly(error.message);
      if (data.session) {
        // Email confirmation turned off: already signed in. Full load so the proxy sees the new session cookies.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/college");
        return null;
      }
      // Same message whether or not the email already had an account (Supabase doesn't say), so it can't be probed.
      setSent(`We've emailed a confirmation link to ${parsed.data.email}. Open it to finish creating your account, then register your college.`);
      return null;
    });

  const google = () =>
    run("google", async () => {
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
            {widget}
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
            {widget}
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-12" disabled={pending !== null}>
              {pending === "password" && <Loader2Icon className="animate-spin" />}
              Sign in
            </Button>
            <FieldSeparator>or</FieldSeparator>
            <Button type="button" variant="outline" className="h-12" disabled={pending !== null} onClick={magicLink}>
              {pending === "magic" ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
              Email me a login link
            </Button>
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
            {widget}
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
