import { ArrowRightIcon, SchoolIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";
import { getApprovedColleges, type WallCollege } from "@/lib/data/wall";
import { brandedSeason } from "@/lib/league";

export const metadata: Metadata = {
  title: "Colleges",
  description: "Colleges competing in the Matiks College League this season.",
};

export default async function CollegesPage() {
  const league = await getActiveLeague();
  const colleges = league ? await getApprovedColleges(league.id) : [];
  // Prerendered page, so no clock here: the toggle only. /register checks the deadline live.
  const open = league?.registration_open ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">{brandedSeason(league?.name)}</p>
          <h1 className="text-5xl sm:text-6xl">Colleges</h1>
          {colleges.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-primary">{colleges.length}</span> confirmed
            </p>
          )}
        </div>
        {open && (
          <Button asChild className="h-11 uppercase">
            <Link href="/register">
              Register your college <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </div>

      {colleges.length === 0 ? (
        <EmptyState
          icon={SchoolIcon}
          mascot
          title="No colleges yet"
          description={open ? "Register yours and it shows up here once approved." : "Approved colleges show up here."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colleges.map((c) => (
            <CollegeCard key={c.id} college={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CollegeCard({ college: c }: { college: WallCollege }) {
  const initials = (c.short_name ?? c.name)
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      {c.logo_url ? (
        // Logos can live on any host; a plain img avoids allow-listing each one for next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-lg bg-muted object-contain" />
      ) : (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-olive font-display text-lg text-primary">
          {initials || "?"}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-medium leading-snug">{c.name}</p>
        {(c.city || c.state) && <p className="text-xs text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ")}</p>}
      </div>
    </li>
  );
}
