"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

// Inlined at build time. Turn on once the Google provider is configured in Supabase.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true";

export function LoginForm({ next }: { next?: string }) {
  const [pending, setPending] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const destination = safeNext(next);

  async function onPasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending("password");
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setError(error.message);
      setPending(null);
      return;
    }
    // Full navigation so src/proxy.ts runs the admin check with the new session cookies.
    window.location.assign(destination);
  }

  async function onGoogleLogin() {
    setPending("google");
    setError(null);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", destination);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) {
      setError(error.message);
      setPending(null);
    }
  }

  return (
    <form onSubmit={onPasswordLogin}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11"
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="h-11" disabled={pending !== null}>
          {pending === "password" && <Loader2Icon className="animate-spin" />}
          Log in
        </Button>
        {GOOGLE_LOGIN_ENABLED && (
          <>
            <FieldSeparator>or</FieldSeparator>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending !== null}
              onClick={onGoogleLogin}
            >
              {pending === "google" && <Loader2Icon className="animate-spin" />}
              Continue with Google
            </Button>
          </>
        )}
      </FieldGroup>
    </form>
  );
}
