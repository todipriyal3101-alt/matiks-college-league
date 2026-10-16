import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { RegistrationForm } from "@/components/register/registration-form";
import { Button } from "@/components/ui/button";
import { getActiveLeague, isRegistrationOpen } from "@/lib/data/leagues";

export const metadata: Metadata = { title: "Register your college" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 font-display text-3xl font-bold">Register your college</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
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
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Registrations closed</h2>
        <p className="text-sm text-muted-foreground">
          {league
            ? `Registrations for ${league.name} aren't open right now.`
            : "There's no league open for registration right now."}{" "}
          Follow Matiks on social media to hear when the next season opens.
          {/* TODO: link Matiks Instagram / WhatsApp channel. */}
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return <RegistrationForm leagueName={league.name} />;
}
