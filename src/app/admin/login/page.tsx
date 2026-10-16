import type { Metadata } from "next";
import { Suspense } from "react";

import { logout } from "@/app/admin/(panel)/actions";
import { Button } from "@/components/ui/button";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login" };

const ERRORS: Record<string, string> = {
  no_access: "You don't have admin access. Ask an admin to add you, or log in with a different account.",
  auth_failed: "Login failed. Please try again.",
};

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Admin login</h1>
          <p className="text-sm text-muted-foreground">Matiks College League</p>
        </div>
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
