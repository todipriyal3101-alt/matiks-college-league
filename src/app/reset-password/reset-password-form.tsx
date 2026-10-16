"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** Arrives here from the reset email via /auth/callback, which has already signed the user in. */
export function ResetPasswordForm() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setReady(!!data.user));
  }, []);

  if (ready === null) return <p className="text-sm text-muted-foreground">Checking your link…</p>;
  if (!ready) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">This reset link has expired or was already used.</p>
        <Button asChild className="h-11 w-full">
          <Link href="/login">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters.");
        if (password !== confirm) return setError("The passwords don't match.");
        setPending(true);
        setError(null);
        const { error } = await createClient().auth.updateUser({ password });
        if (error) {
          setError(error.message);
          setPending(false);
          return;
        }
        window.location.assign("/auth/continue");
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Update password
        </Button>
      </FieldGroup>
    </form>
  );
}
