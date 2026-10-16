import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { SUPPORT_EMAIL } from "@/app/(public)/content";
import { ShareButtons } from "@/components/register/share-buttons";
import { Mascot } from "@/components/league/mascot";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Registration received" };

const NEXT_STEPS = [
  { title: "We review it", body: "The Matiks team checks your registration." },
  { title: "Check your email", body: "Once approved, you get an invite to your college portal." },
  { title: "Set up your college", body: "Sign in and add your contact details. Winners go in after the league." },
];

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
  const message = `${registration.collegeName} is in ${leagueName}, the 7-day online college league by Matiks. Play it smart. Get your college in:`;

  return (
    <div className="space-y-6 text-center">
      <Mascot priority className="mx-auto size-36" />
      <div className="space-y-2">
        <h1 className="text-5xl">You&apos;re in!</h1>
        <p className="text-muted-foreground">
          <strong className="text-foreground">{registration.collegeName}</strong> is registered.
        </p>
      </div>
      <div className="space-y-3 rounded-3xl border bg-card p-5 text-left">
        <h2 className="text-2xl">What happens next</h2>
        <ol className="space-y-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-olive font-mono text-sm text-primary">{i + 1}</span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-2xl">Challenge other colleges</h2>
        <ShareButtons url={`${siteUrl}/register`} message={message} />
      </div>
      <p className="text-sm text-muted-foreground">
        Questions?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
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
