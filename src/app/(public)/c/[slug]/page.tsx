import { ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { BadgeList } from "@/components/launch/badge-list";
import { PrizeProgress } from "@/components/launch/prize-progress";
import { ShareRow } from "@/components/launch/share-row";
import { StageBadge } from "@/components/league/badges";
import { CollegeLogo } from "@/components/league/college-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicCollege } from "@/lib/data/public";
import { formatDay } from "@/lib/ist";
import { siteUrl } from "@/lib/site-url";

const SLUG = /^[a-z0-9-]{1,120}$/;

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = SLUG.test(slug) ? await getPublicCollege(slug) : null;
  if (!c) return { title: "College" };
  return {
    title: `${c.name} is in the Matiks College League`,
    description: `${c.name}${c.city ? `, ${c.city}` : ""}: ${c.players} players so far. Take the 30-second duel and help unlock a bigger prize pool.`,
  };
}

/** Public college page: public fields only (never a POC's name, email or phone). */
export default function CollegePage({ params }: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-3xl" />}>
      <College params={params} />
    </Suspense>
  );
}

async function College({ params }: Pick<PageProps<"/c/[slug]">, "params">) {
  const { slug } = await params;
  const c = SLUG.test(slug) ? await getPublicCollege(slug) : null;
  if (!c) notFound();
  const url = `${siteUrl}/c/${c.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Glass className="space-y-5 p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <CollegeLogo url={c.logo_url} name={c.name} className="size-16 sm:size-20" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{[c.season, c.city, c.state].filter(Boolean).join(" · ")}</p>
            <h1 className="text-5xl sm:text-6xl">
              {c.name} <span className="text-primary">is in!</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StageBadge stage={c.stage} />
          {c.league_start && (
            <span className="text-muted-foreground">
              League {formatDay(c.league_start)}
              {c.league_end ? ` – ${formatDay(c.league_end)}` : ""}
            </span>
          )}
          {c.club_name && <span className="text-muted-foreground">· Hosted by {c.club_name}</span>}
        </div>
        <PrizeProgress players={c.players} country={c.country} />
        {c.badges.length > 0 && <BadgeList earned={c.badges} />}
      </Glass>
      <Glass className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
        <p className="flex-1 text-sm text-foreground/85">Studying at {c.name}? Take the 30-second math duel, then ask your college&apos;s POC how to join the league.</p>
        <Button asChild className="h-11 rounded-full px-5">
          <Link href="/duel">
            <ZapIcon /> Play the duel
          </Link>
        </Button>
      </Glass>
      <ShareRow url={url} text={`${c.name} is in the Matiks College League! 🧠⚡`} />
    </div>
  );
}
