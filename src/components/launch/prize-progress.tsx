"use client";

import { useEffect, useState } from "react";

import { formatINR, prizeProgress } from "@/lib/league";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/validation/portal";

/**
 * "212 / 400 players: 188 more to unlock ₹7,500", animated in on mount (instant with reduced motion).
 * USA has no auto tiers (prize set by admins), so it shows players only.
 */
export function PrizeProgress({ players, country = "india", className }: { players: number; country?: Country; className?: string }) {
  const p = prizeProgress(players);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(p.pct));
    return () => cancelAnimationFrame(id);
  }, [p.pct]);
  const count = new Intl.NumberFormat("en-IN").format(p.players);

  if (country === "usa") {
    return (
      <p className={cn("font-semibold", className)}>
        <span className="font-mono text-2xl text-primary">{count}</span> players
      </p>
    );
  }
  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">
          <span className="font-mono text-2xl">{count}</span>
          {p.next && <span className="text-muted-foreground"> / {p.next.min}</span>} players
        </span>
        <span className="text-sm font-bold text-primary">{formatINR(p.unlocked)} unlocked</span>
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.pct}
        aria-label={p.next ? `${p.remaining} more players to unlock ${formatINR(p.next.amount)}` : "Top prize tier unlocked"}
        className="h-3 overflow-hidden rounded-full bg-white/8"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#e8ff9c] transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: `${width}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        {p.next ? (
          <>
            <span className="font-semibold text-foreground">{p.remaining}</span> more to unlock <span className="font-semibold text-primary">{formatINR(p.next.amount)}</span>
          </>
        ) : (
          "Top prize tier unlocked 🏆"
        )}
      </p>
    </div>
  );
}
