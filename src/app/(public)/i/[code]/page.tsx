import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DuelLoader } from "@/components/duel/duel-loader";
import { Glass } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicInvite } from "@/lib/data/public";
import { inviteHeadline } from "@/lib/invite-copy";
import { INVITE_CODE_RE } from "@/lib/invite-cookie";

// Personal invite links: src/proxy.ts remembers the code (cookie) so the plays and registrations that follow count.
export async function generateMetadata({ params }: PageProps<"/i/[code]">): Promise<Metadata> {
  const { code } = await params;
  const invite = INVITE_CODE_RE.test(code) ? await getPublicInvite(code) : null;
  if (!invite) return { title: "Invite", robots: { index: false } };
  const h = inviteHeadline(invite);
  return {
    title: `${h.title}: ${h.kicker}`,
    description: "A 30-second math duel from the Matiks College League. No sign-up. Then rally your college.",
    robots: { index: false, follow: false },
  };
}

export default function InvitePage({ params }: PageProps<"/i/[code]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[34rem] w-full rounded-3xl" />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: Pick<PageProps<"/i/[code]">, "params">) {
  const { code } = await params;
  if (!INVITE_CODE_RE.test(code)) notFound();
  const invite = await getPublicInvite(code);
  if (!invite) notFound();
  const h = inviteHeadline(invite);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Matiks College League</p>
        <h1 className="mt-1 text-5xl sm:text-6xl">
          {h.title}: <span className="text-primary">{h.kicker.toLowerCase()}</span>
        </h1>
        <p className="mt-3 text-foreground/85">
          {invite.kind === "player"
            ? "30 seconds of mental math. No sign-up. Then bring your college into the league."
            : "Bring your college into India's inter-college mind sports league. Free to enter; the prize pool grows with your turnout."}
        </p>
      </div>
      <DuelLoader eager beat={invite.score} rival={invite.college_name ?? undefined} />
      <Glass className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
        <p className="flex-1 text-sm text-foreground/85">Run the league at your college: free, and the prize pool grows with your turnout (up to ₹10,000).</p>
        <Button asChild className="h-11 rounded-full px-5">
          <Link href="/login?mode=signup">
            Register your college <ArrowRightIcon />
          </Link>
        </Button>
      </Glass>
      {invite.college_slug && (
        <p className="text-center text-sm">
          <Link href={`/c/${invite.college_slug}`} className="font-semibold text-primary underline-offset-4 hover:underline">
            See {invite.college_name} in the college race →
          </Link>
        </p>
      )}
    </div>
  );
}
