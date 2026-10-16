import { SwordsIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/league/empty-state";
import { getFixtures, type Fixture } from "@/lib/data/fixtures";
import { getActiveLeague } from "@/lib/data/leagues";
import { istDateTime } from "@/lib/ist";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fixtures" };

export default async function FixturesPage() {
  const league = await getActiveLeague();
  const fixtures = league ? await getFixtures(league.id) : [];
  const rounds = [...new Set(fixtures.map((f) => f.round))];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">{league?.name ?? "Matiks College League"}</p>
        <h1 className="text-5xl sm:text-6xl">Fixtures</h1>
      </div>
      {fixtures.length === 0 ? (
        <EmptyState mascot icon={SwordsIcon} title="Fixtures soon" description="Matches are announced after registrations close." />
      ) : (
        rounds.map((round) => (
          <section key={round} className="space-y-3">
            <h2 className="text-3xl">{round}</h2>
            <ul className="space-y-2">
              {fixtures
                .filter((f) => f.round === round)
                .map((f) => (
                  <FixtureCard key={f.id} f={f} />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function FixtureCard({ f }: { f: Fixture }) {
  const played = f.score_a != null && f.score_b != null;
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team name={f.a.short_name ?? f.a.name} winner={f.winner_id === f.a.id} />
        <span className="font-mono text-lg tabular-nums">{played ? `${f.score_a} – ${f.score_b}` : "vs"}</span>
        <Team name={f.b.short_name ?? f.b.name} winner={f.winner_id === f.b.id} alignEnd />
      </div>
      <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
        {f.scheduled_at ? istDateTime.format(new Date(f.scheduled_at)) : "Date to be announced"}
      </p>
    </li>
  );
}

function Team({ name, winner, alignEnd }: { name: string; winner: boolean; alignEnd?: boolean }) {
  return (
    <span className={cn("min-w-0 text-sm", alignEnd && "text-right", winner && "font-semibold text-primary")}>
      {winner && <TrophyIcon className="mr-1 inline size-3.5" />}
      {name}
    </span>
  );
}
