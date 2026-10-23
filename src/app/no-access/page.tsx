import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admins only" };

/** Where src/proxy.ts sends a signed-in non-admin who opens /admin. */
export default function NoAccessPage() {
  return (
    <AuthCard subtitle="Admins only">
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <NoAccess />
      </Suspense>
    </AuthCard>
  );
}

async function NoAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-4xl">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          That page is for the Matiks team. <strong className="text-foreground">{data?.claims.email ?? "Your account"}</strong>{" "}
          is a college POC account: your college lives in the college portal.
        </p>
      </div>
      <Button asChild className="h-12 w-full">
        <Link href="/college">Go to your college</Link>
      </Button>
      <form action={logout}>
        <Button type="submit" variant="outline" className="h-12 w-full">
          Log out and use another account
        </Button>
      </form>
    </>
  );
}
