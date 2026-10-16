import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/lib/auth/actions";
import { getMyRegistrations } from "@/lib/data/league-ops";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <AuthCard subtitle="No access">
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <NoAccess />
      </Suspense>
    </AuthCard>
  );
}

async function NoAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = <strong className="text-foreground">{data?.claims.email ?? "Your account"}</strong>;
  // A POC who followed an admin link: they do have a college, just not the admin panel.
  const isPoc = !!data?.claims.sub && (await getMyRegistrations()).length > 0;

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-4xl">{isPoc ? "Admins only" : "No access yet"}</h1>
        <p className="text-sm text-muted-foreground">
          {isPoc ? (
            <>That page is for the Matiks team. {email} manages a college: open it below.</>
          ) : (
            <>
              {email} isn&apos;t linked to a college yet. You&apos;ll get an email invite once your college is approved:
              sign in with that email.
            </>
          )}
        </p>
      </div>
      {isPoc && (
        <Button asChild className="h-12 w-full">
          <Link href="/college">Go to your college</Link>
        </Button>
      )}
      <form action={logout}>
        <Button type="submit" variant="outline" className="h-12 w-full">
          Log out and use another account
        </Button>
      </form>
    </>
  );
}
