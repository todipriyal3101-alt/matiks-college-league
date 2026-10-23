import type { Metadata } from "next";
import { Suspense } from "react";

import { PauseRegistrations } from "@/components/admin/seasons/pause-registrations";
import { SeasonsList } from "@/components/admin/seasons/seasons-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getRegistrationsPaused } from "@/lib/data/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seasons" };

export default function SeasonsPage() {
  return (
    <div className="fade-in space-y-8">
      <div>
        <h1 className="text-5xl sm:text-6xl">Seasons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New POC registrations join the newest season that isn&apos;t completed (one is created if none exists).
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Seasons />
      </Suspense>
    </div>
  );
}

async function Seasons() {
  const { isWriter } = await requireAdmin();
  const supabase = await createClient();
  const [leagues, regs, paused] = await Promise.all([
    supabase.from("leagues").select("*").order("season", { ascending: false }),
    supabase.from("registrations").select("league_id"),
    getRegistrationsPaused(),
  ]);
  const counts = new Map<string, number>();
  for (const r of regs.data ?? []) counts.set(r.league_id, (counts.get(r.league_id) ?? 0) + 1);
  const seasons = (leagues.data ?? []).map((l) => ({ ...l, registrations: counts.get(l.id) ?? 0 }));
  return (
    <div className="space-y-6">
      <PauseRegistrations paused={paused} isWriter={isWriter} />
      <SeasonsList seasons={seasons} isWriter={isWriter} />
    </div>
  );
}
