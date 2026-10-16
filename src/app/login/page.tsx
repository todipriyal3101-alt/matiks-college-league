import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That link expired or was already used. Get a new one below.",
  reset_expired: "That reset link expired or was already used. Enter your email to get a new one.",
  auth_failed: "Sign-in failed. Please try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard subtitle="Sign in">
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error, next, mode } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  // Already signed in: go home (or to `next`).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub) redirect(`/auth/continue${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);

  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return (
    <>
      {message && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          {message}
        </p>
      )}
      <LoginForm next={nextPath} initialMode={mode === "forgot" || error === "reset_expired" ? "forgot" : "password"} />
      <p className="text-center text-xs text-muted-foreground">
        {nextPath?.startsWith("/college")
          ? "Registered a college? You'll get an email invite once it's approved."
          : "Invite only. Registered a college? You'll get an email invite once it's approved."}
      </p>
    </>
  );
}
