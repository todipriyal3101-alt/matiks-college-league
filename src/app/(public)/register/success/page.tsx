import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ShareButtons } from "@/components/register/share-buttons";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Registration received" };

export default function RegisterSuccessPage({ searchParams }: PageProps<"/register/success">) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
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
        <h1 className="font-display text-3xl font-bold">Registration not found</h1>
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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">You&apos;re in! 🎉</h1>
        <p className="text-muted-foreground">
          We&apos;ve received the registration for <strong className="text-foreground">{registration.collegeName}</strong>.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Registration ID</p>
        <p className="font-mono text-sm break-all">{registration.id}</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-lg font-semibold">What happens next</h2>
        {/* TODO: confirm next-steps copy and timelines with the league team. */}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Our team reviews your registration (status: pending).</li>
          <li>We&apos;ll contact you on WhatsApp/email once it&apos;s approved.</li>
          <li>Sign in to your college portal any time to update your contacts and, later, your winners.</li>
        </ol>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Challenge other colleges</h2>
        <ShareButtons url={`${siteUrl}/register`} message={message} />
      </div>

      <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
        <Link href="/college">Go to your college portal</Link>
      </Button>
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
