"use client";

import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** Supabase password errors in plain words. */
function friendly(message: string) {
  if (/different from the old password/i.test(message)) return "That's your current password. Choose a new one.";
  if (/session|jwt|expired|not authenticated/i.test(message)) return "This reset link has expired. Request a new one from the sign-in page.";
  if (/weak|pwned|leaked/i.test(message)) return "That password is too easy to guess. Try a longer one.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a minute, then try again.";
  return message;
}

/** Arrives here from the reset email via /auth/callback, which has already signed the user in. */
export function ResetPasswordForm() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
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
        <p className="text-sm text-muted-foreground">This reset link has expired or was already used. Get a new one, it only takes a moment.</p>
        <Button asChild className="h-11 w-full">
          <Link href="/login?mode=forgot">Send a new link</Link>
        </Button>
      </div>
    );
  }

  const type = show ? "text" : "password";
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters.");
        if (password !== confirm) return setError("The two passwords don't match.");
        setPending(true);
        setError(null);
        const { error } = await createClient().auth.updateUser({ password });
        if (error) {
          setError(friendly(error.message));
          setPending(false);
          return;
        }
        // Full page load on purpose: /auth/continue is a route handler redirect (to /admin or /college),
        // and the new session cookies must reach the proxy.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/auth/continue");
      }}
    >
      <FieldGroup>
        <Field data-invalid={!!error && password.length < 8}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <div className="relative">
            <Input
              id="new-password"
              type={type}
              autoComplete="new-password"
              autoFocus
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide passwords" : "Show passwords"}
              aria-pressed={show}
            >
              {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type={type}
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11"
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
