"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Glass } from "@/components/glass";
import { CollegeLogo } from "@/components/league/college-logo";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/league";
import { stateCode, TILES } from "@/lib/tile-maps";
import { cn } from "@/lib/utils";
import { COUNTRY_FLAGS, COUNTRY_LABELS, type Country } from "@/lib/countries";

const TileMap = dynamic(() => import("@/components/launch/tile-map"), { ssr: false, loading: () => <Skeleton className="aspect-[9/7] w-full rounded-2xl" /> });

export type RaceCollege = { slug: string; name: string; city: string | null; state: string | null; logo_url: string | null; players: number; prize_pool: number | null };

/** Live college race: leaderboard (top 3 highlighted) + tile map; India / USA. Public fields only. */
export function CollegeRace({ data }: { data: Record<Country, RaceCollege[]> }) {
  const [country, setCountry] = useState<Country>("india");
  const [state, setState] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setMapVisible(true), { rootMargin: "200px" });
    io.observe(mapRef.current);
    return () => io.disconnect();
  }, []);

  const rows = data[country];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) {
      const code = stateCode(country, r.state);
      if (code) c[code] = (c[code] ?? 0) + 1;
    }
    return c;
  }, [rows, country]);
  const inState = state ? rows.filter((r) => stateCode(country, r.state) === state) : [];
  const stateName = state ? TILES[country].find((t) => t.code === state)?.name : null;
  const visible = showAll ? rows : rows.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Live college race</p>
          <h2 className="text-5xl sm:text-6xl">Who&apos;s leading?</h2>
        </div>
        <SegmentedControl
          label="Country"
          value={country}
          onChange={(c) => {
            setCountry(c);
            setState(null);
            setShowAll(false);
          }}
          options={(["india", "usa"] as const).map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Glass className="p-2 sm:p-3">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No colleges approved in {COUNTRY_LABELS[country]} yet. Yours could be first!</p>
          ) : (
            <>
              <ol className="space-y-1">
                {visible.map((r, i) => (
                  <li key={r.slug}>
                    <Link href={`/c/${r.slug}`} className={cn("grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/6", i < 3 && "bg-primary/8")}>
                      <span className={cn("font-display text-2xl", i < 3 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                      <CollegeLogo url={r.logo_url} name={r.name} className="size-10" />
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.city ?? r.state}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono font-bold">{r.players}</span>
                        <span className={cn("block font-mono text-xs", i < 3 ? "text-primary" : "text-muted-foreground")}>{r.prize_pool != null ? formatINR(r.prize_pool) : "players"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              {rows.length > 8 && (
                <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 w-full rounded-xl py-2 text-sm font-semibold text-primary hover:bg-white/5">
                  {showAll ? "Show top 8" : `Show all ${rows.length}`}
                </button>
              )}
            </>
          )}
        </Glass>
        <Glass className="space-y-3 p-4 sm:p-5">
          <div ref={mapRef}>{mapVisible ? <TileMap country={country} counts={counts} selected={state} onSelect={setState} /> : <Skeleton className="aspect-[9/7] w-full rounded-2xl" />}</div>
          {state ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">
                {stateName} · {inState.length} {inState.length === 1 ? "college" : "colleges"}
              </p>
              {inState.length === 0 ? (
                <p className="text-xs text-muted-foreground">No colleges here yet. Register yours!</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {inState.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/c/${r.slug}`} className="inline-flex rounded-full bg-white/7 px-3 py-1 text-xs font-semibold hover:bg-white/12">
                        {r.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Brighter = more colleges. Tap a state to see them.</p>
          )}
        </Glass>
      </div>
    </div>
  );
}
