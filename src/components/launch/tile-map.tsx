"use client";

import { TILES } from "@/lib/tile-maps";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/validation/portal";

/** States as tiles, brighter with more colleges; tap one to see its colleges. Keyboard: Tab + Enter. */
export default function TileMap({
  country,
  counts,
  selected,
  onSelect,
}: {
  country: Country;
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const tiles = TILES[country];
  const cols = Math.max(...tiles.map((t) => t.col)) + 1;
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }} role="group" aria-label="Colleges by state">
      {tiles.map((t) => {
        const n = counts[t.code] ?? 0;
        const level = n === 0 ? 0 : Math.ceil((n / max) * 3);
        return (
          <button
            key={t.code}
            type="button"
            onClick={() => onSelect(selected === t.code ? null : t.code)}
            aria-pressed={selected === t.code}
            aria-label={`${t.name}: ${n} ${n === 1 ? "college" : "colleges"}`}
            title={`${t.name} · ${n}`}
            style={{ gridColumnStart: t.col + 1, gridRowStart: t.row + 1 }}
            className={cn(
              "grid aspect-square place-items-center rounded-lg text-[9px] font-bold transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring sm:rounded-xl sm:text-[11px]",
              level === 0 && "bg-white/5 text-foreground/45",
              level === 1 && "bg-primary/25 text-[#e9ffd3]",
              level === 2 && "bg-primary/50 text-[#10200a]",
              level === 3 && "bg-primary text-primary-foreground",
              selected === t.code && "ring-2 ring-lilac ring-offset-2 ring-offset-background",
            )}
          >
            {t.code}
          </button>
        );
      })}
    </div>
  );
}
