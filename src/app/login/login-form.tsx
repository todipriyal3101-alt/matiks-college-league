"use client";

import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

// Inlined at build time. Turn on once the Google provider is configured in Supabase.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true";

type Mode = "password" | "forgot";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"password" | "magic" | "reset" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const continueUrl = `/auth/continue${next ? `?next=${encodeURIComponent(safeNext(next, "/"))}` : ""}`;
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(continueUrl)}`;

  async function run(kind: NonNullable<typeof pending>, fn: () => Promise<string | null>) {
    setPending(kind);
    setError(null);
    setError(await fn());
    setPending(null);
  }

  const passwordLogin = () =>
    run("password", async () => {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return error.message === "Invalid login credentials" ? "Wrong email or password." : error.message;
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
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: callback() },
      });
      if (error) {
        return /signups not allowed|not found/i.test(error.message)
          ? "There's no account for this email yet. If you registered a college, you'll get an email invite once it's approved."
          : error.message;
      }
      setSent(`We've emailed a login link to ${email.trim()}. Open it on any device.`);
      return null;
    });

  const resetPassword = () =>
    run("reset", async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) return error.message;
      setSent(`If ${email.trim()} has an account, a reset link is on its way.`);
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
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent text-primary">
          <MailIcon className="size-5" />
        </div>
        <p className="text-sm">{sent}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setSent(null); setMode("password"); }}>
          <ArrowLeftIcon /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (mode === "password" ? passwordLogin() : resetPassword());
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        {mode === "password" ? (
          <>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setMode("forgot"); setError(null); }}>
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-11" disabled={pending !== null}>
              {pending === "password" && <Loader2Icon className="animate-spin" />}
              Sign in
            </Button>
            <FieldSeparator>or</FieldSeparator>
            <Button type="button" variant="outline" className="h-11" disabled={pending !== null} onClick={magicLink}>
              {pending === "magic" ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
              Email me a login link
            </Button>
            {GOOGLE_LOGIN_ENABLED && (
              <Button type="button" variant="outline" className="h-11" disabled={pending !== null} onClick={google}>
                {pending === "google" && <Loader2Icon className="animate-spin" />}
                Continue with Google
              </Button>
            )}
          </>
        ) : (
          <>
            <FieldDescription>We&apos;ll email you a link to choose a new password.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" className="h-11" disabled={pending !== null}>
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
