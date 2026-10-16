import type { Metadata } from "next";
import { Suspense } from "react";

import { logout } from "@/app/admin/(panel)/actions";
import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login" };

const ERRORS: Record<string, string> = {
  no_access: "You don't have admin access. Ask an admin to add you, or log in with a different account.",
  auth_failed: "Login failed. Please try again.",
};

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="relative isolate flex min-h-full flex-1 items-center justify-center overflow-hidden p-4">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <Logo subtitle="Admin console" />
        <h1 className="sr-only">Admin login</h1>
        <Suspense>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { error, next } = await searchParams;
  const errorKey = typeof error === "string" ? error : undefined;
  const message = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <>
      {message && (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>{message}</p>
          {errorKey === "no_access" && (
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          )}
        </div>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
