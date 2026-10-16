import { ArrowRightIcon, SchoolIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";
import { getApprovedColleges, type WallCollege } from "@/lib/data/wall";

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
          <p className="text-xs tracking-[0.2em] text-primary uppercase">{league?.name ?? "Matiks College League"}</p>
          <h1 className="font-display text-3xl font-bold">Colleges in the league</h1>
          {colleges.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{colleges.length}</span> college{colleges.length === 1 ? "" : "s"} confirmed
            </p>
          )}
        </div>
        {open && (
          <Button asChild>
            <Link href="/register">
              Register your college <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </div>

      {colleges.length === 0 ? (
        <EmptyState
          icon={SchoolIcon}
          title="No colleges confirmed yet"
          description={open ? "Be the first: register your college and it appears here once approved." : "Colleges appear here once they're approved. Check back soon."}
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
    <li className="flex items-center gap-3 rounded-xl border bg-card p-4">
      {c.logo_url ? (
        // Logos can live on any host; a plain img avoids allow-listing each one for next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-lg bg-muted object-contain" />
      ) : (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
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
