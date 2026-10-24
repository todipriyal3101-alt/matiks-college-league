import type { Metadata } from "next";
import { Suspense } from "react";

import { DuelEntries } from "@/components/admin/growth/duel-entries";
import { Glass } from "@/components/glass";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Growth" };

/** League tools › Growth: who brings people in (invite links) and today's duel board (hide entries). */
export default function GrowthPage() {
  return (
    <div className="fade-in space-y-6">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Launch</p>
        <h1 className="text-5xl sm:text-6xl">Growth</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <Growth />
      </Suspense>
    </div>
  );
}

async function Growth() {
  const { isWriter } = await requireAdmin();
  const supabase = await createClient();
  const IST = 5.5 * 3600_000;
  const DAY = 86_400_000;
  const since = new Date(Math.floor((Date.now() + IST) / DAY) * DAY - IST).toISOString();
  const [inviters, rounds, plays] = await Promise.all([
    supabase.rpc("admin_top_inviters", { p_limit: 25 }),
    supabase
      .from("duel_rounds")
      .select("id, player_name, score, hidden, colleges(name), invite_codes(display_name)")
      .gte("submitted_at", since)
      .not("player_name", "is", null)
      .order("score", { ascending: false })
      .limit(100),
    supabase.from("duel_rounds").select("id", { count: "exact", head: true }).gte("submitted_at", since),
  ]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Glass className="space-y-3 p-4 sm:p-5">
        <h2 className="font-sans text-xs font-bold tracking-[0.12em] text-lilac normal-case">Top inviters</h2>
        {!inviters.data?.length ? (
          <p className="text-sm text-muted-foreground">Nobody has brought anyone in through an invite link yet.</p>
        ) : (
          <ol className="space-y-1.5">
            {inviters.data.map((i, n) => (
              <li key={i.code} className="glass-surface flex items-center gap-3 rounded-2xl p-3 text-sm">
                <span className="w-5 font-display text-xl text-muted-foreground">{n + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{i.display_name ?? "Someone"}</span>
                  {i.college_name && <span className="text-muted-foreground"> · {i.college_name}</span>}
                  <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-muted-foreground">{i.kind === "poc" ? "POC" : "Player"}</span>
                </span>
                <span className="text-right font-mono text-xs">
                  <span className="block">{i.plays} plays</span>
                  <span className="block text-primary">{i.registrations} colleges</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Glass>
      <Glass className="space-y-3 p-4 sm:p-5">
        <h2 className="font-sans text-xs font-bold tracking-[0.12em] text-lilac normal-case">
          Duels today · {plays.count ?? 0} played
        </h2>
        <DuelEntries
          isWriter={isWriter}
          entries={(rounds.data ?? []).map((r) => ({
            id: r.id,
            player_name: r.player_name,
            score: r.score,
            hidden: r.hidden,
            college: r.colleges?.name ?? null,
            via: r.invite_codes?.display_name ?? null,
          }))}
        />
      </Glass>
    </div>
  );
}
