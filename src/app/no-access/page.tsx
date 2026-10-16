import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "No access yet" };

export default function NoAccessPage() {
  return (
    <AuthCard subtitle="No access yet">
      <div className="space-y-2">
        <h1 className="text-4xl">No access yet</h1>
        <p className="text-sm text-muted-foreground">
          <Suspense fallback="Your account">
            <SignedInAs />
          </Suspense>{" "}
          isn&apos;t linked to a college yet. You&apos;ll get an email invite once your college is approved: sign in
          with that email.
        </p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline" className="h-12 w-full">
          Log out and use another account
        </Button>
      </form>
    </AuthCard>
  );
}

async function SignedInAs() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <strong className="text-foreground">{data?.claims.email ?? "Your account"}</strong>;
}
