"use client";

import { formatINR, PRIZE_TIERS } from "@/lib/league";
import { cn } from "@/lib/utils";
import { TARGET_MAX, TARGET_MIN, type Country } from "@/lib/validation/portal";

const TIERS = [...PRIZE_TIERS].reverse();
const pct = (v: number) => ((v - TARGET_MIN) / (TARGET_MAX - TARGET_MIN)) * 100;

/** "How many players can you bring?" 50–1000, with the prize tier it unlocks (India; USA shows players only). */
export function SquadTarget({ value, onChange, country, id }: { value: number; onChange: (v: number) => void; country: Country; id: string }) {
  const tier = TIERS.findLast((t) => value >= t.min) ?? TIERS[0];
  const usa = country === "usa";
  return (
    <div className="space-y-4">
      <p className="text-center" aria-hidden>
        <span className="font-display text-8xl leading-none text-primary tabular-nums">{value}</span>
        <span className="ml-1 font-bold text-muted-foreground">players</span>
      </p>
      <div className="relative px-1">
        <input
          id={id}
          type="range"
          min={TARGET_MIN}
          max={TARGET_MAX}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={usa ? `${value} players` : `${value} players, unlocks ${formatINR(tier.amount)}`}
          className="squad-range h-11 w-full cursor-pointer appearance-none bg-transparent"
          style={{ "--fill": `${pct(value)}%` } as React.CSSProperties}
        />
        {!usa && (
          <div aria-hidden className="pointer-events-none absolute inset-x-1 top-[31px] h-2.5">
            {TIERS.filter((t) => t.min > TARGET_MIN).map((t) => (
              <span key={t.min} className="absolute h-2.5 w-0.5 bg-white/30" style={{ left: `${pct(t.min)}%` }} />
            ))}
          </div>
        )}
        <div className="mt-1 flex justify-between text-xs font-semibold text-muted-foreground" aria-hidden>
          <span>{TARGET_MIN}</span>
          <span>{TARGET_MAX}</span>
        </div>
      </div>
      {usa ? (
        <p className="text-center text-sm text-muted-foreground">USA prize pools are set per college by Matiks.</p>
      ) : (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Prize tiers">
          {TIERS.map((t) => {
            const on = t === tier;
            return (
              <li
                key={t.min}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "rounded-xl bg-white/4 px-1 py-2 text-center text-[11px] font-bold text-muted-foreground transition-colors",
                  on && "bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_rgb(177_250_99/0.45)]",
                )}
              >
                <span className={cn("block font-display text-xl leading-tight sm:text-2xl", on ? "text-primary" : "text-foreground/45")}>{formatINR(t.amount)}</span>
                {t.min ? `${t.min}+` : "any"}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
