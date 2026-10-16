import type { Metadata } from "next";
import { Suspense } from "react";

import { MatchesList } from "@/components/admin/matches/matches-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { getOverview } from "@/lib/data/league-ops";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Matches" };

export default function MatchesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Matches</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fixtures and results for the selected season. Shown publicly at /fixtures.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Matches />
      </Suspense>
    </div>
  );
}

async function Matches() {
  const [{ isWriter }, league] = await Promise.all([requireAdmin(), getSelectedLeague()]);
  if (!league) return <p className="text-sm text-muted-foreground">Create a season first.</p>;
  const supabase = await createClient();
  const [rows, matches] = await Promise.all([
    getOverview(league.id),
    supabase.from("matches").select("*").eq("league_id", league.id).order("scheduled_at", { nullsFirst: false }).order("created_at"),
  ]);
  const ids = [...new Set((matches.data ?? []).flatMap((m) => [m.college_a_id, m.college_b_id]))];
  const { data: named } = ids.length ? await supabase.from("colleges").select("id, name").in("id", ids) : { data: [] };
  return (
    <MatchesList
      leagueId={league.id}
      matches={matches.data ?? []}
      colleges={rows.filter((r) => r.review_status === "approved").map((r) => ({ id: r.college_id!, name: r.college_name! }))}
      allColleges={Object.fromEntries((named ?? []).map((c) => [c.id, c.name]))}
      isWriter={isWriter}
    />
  );
}
