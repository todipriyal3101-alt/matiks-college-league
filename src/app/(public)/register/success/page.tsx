import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ShareButtons } from "@/components/register/share-buttons";
import { Mascot } from "@/components/league/mascot";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Registration received" };

export default function RegisterSuccessPage({ searchParams }: PageProps<"/register/success">) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<div className="h-80" aria-hidden />}>
        <SuccessContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SuccessContent({ searchParams }: Pick<PageProps<"/register/success">, "searchParams">) {
  const { id } = await searchParams;
  const parsedId = z.uuid().safeParse(id);

  // Only the registration ID and college name are shown here: no names, emails or phones.
  const [registration, league] = await Promise.all([
    parsedId.success ? getRegistrationSummary(parsedId.data) : null,
    getActiveLeague(),
  ]);

  if (!registration) {
    return (
      <div className="space-y-4">
        <h1 className="text-5xl">Registration not found</h1>
        <p className="text-muted-foreground">Check the link, or register your college again.</p>
        <Button asChild className="h-11">
          <Link href="/register">Register your college</Link>
        </Button>
      </div>
    );
  }

  const leagueName = league?.name ?? "Brumble 2.0";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // TODO: final share copy from the Matiks social team.
  const message = `${registration.collegeName} just registered for ${leagueName}, Matiks' inter-college mind sports league! Get your college in:`;

  return (
    <div className="space-y-6 text-center">
      <Mascot priority className="mx-auto size-36" />
      <div className="space-y-2">
        <h1 className="text-5xl">You&apos;re in!</h1>
        <p className="text-muted-foreground">
          <strong className="text-foreground">{registration.collegeName}</strong> is registered. You&apos;ll get an email invite
          once it&apos;s approved.
        </p>
      </div>
      <div className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-2xl">Challenge other colleges</h2>
        <ShareButtons url={`${siteUrl}/register`} message={message} />
      </div>
      <p className="font-mono text-xs break-all text-muted-foreground">ID {registration.id}</p>
    </div>
  );
}

async function getRegistrationSummary(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("registrations")
    .select("id, colleges(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data?.colleges) return null;
  return { id: data.id, collegeName: data.colleges.name };
}
