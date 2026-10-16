import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { RegistrationForm } from "@/components/register/registration-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveLeague, isRegistrationOpen } from "@/lib/data/leagues";

export const metadata: Metadata = { title: "Register your college" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-5xl sm:text-6xl">Register your college</h1>
      <Suspense fallback={<FormSkeleton />}>
        <RegisterContent />
      </Suspense>
    </div>
  );
}

async function RegisterContent() {
  // Request time: the deadline check compares against the current time.
  // Display only — submitRegistration re-checks with getActiveLeagueFresh().
  await connection();
  const league = await getActiveLeague();

  if (!league || !isRegistrationOpen(league)) {
    return (
      <div className="space-y-4 rounded-3xl border bg-card p-6">
        <h2 className="text-3xl">Registrations closed</h2>
        <p className="text-sm text-muted-foreground">
          {league
            ? `Registrations for ${league.name} aren't open right now.`
            : "There's no league open for registration right now."}{" "}
          Follow{" "}
          <a href="https://www.matiks.com" target="_blank" rel="noopener" className="text-primary underline-offset-4 hover:underline">
            Matiks
          </a>{" "}
          to hear when the next season opens.
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return <RegistrationForm leagueName={league.name} />;
}

/** Same shape as step 1, so nothing jumps when the form arrives. */
function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </div>
  );
}
