"use client";

import { useEffect, useState } from "react";

import { Glass } from "@/components/glass";

/** Midnight IST on a "YYYY-MM-DD" date, as epoch ms. */
const istMidnight = (date: string) => new Date(`${date}T00:00:00+05:30`).getTime();

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    { n: Math.floor(s / 86400), l: "days" },
    { n: Math.floor((s % 86400) / 3600), l: "hrs" },
    { n: Math.floor((s % 3600) / 60), l: "min" },
    { n: s % 60, l: "sec" },
  ];
}

/** Countdown to the next league start; with no upcoming date, "Registrations open" (never a broken timer). */
export function Countdown({ date }: { date: string | null }) {
  const target = date ? istMidnight(date) : null;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    // Ticks only in the browser (the server renders "--", so there's no hydration mismatch).
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  if (!target || (now !== null && now >= target)) {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-olive px-4 py-2 text-sm font-bold text-primary">
        <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden /> Registrations open
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Next league starts in</p>
      <div className="flex gap-2.5" role="timer" aria-label={now ? `${parts(target - now).map((p) => `${p.n} ${p.l}`).join(", ")} until the next league starts` : "Countdown"}>
        {parts(now === null ? 0 : target - now).map((p) => (
          <Glass key={p.l} className="w-[4.25rem] rounded-2xl py-2 text-center sm:w-20">
            <span className="block font-display text-4xl leading-none tabular-nums sm:text-[2.6rem]">{now === null ? "--" : String(p.n).padStart(2, "0")}</span>
            <span className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{p.l}</span>
          </Glass>
        ))}
      </div>
    </div>
  );
}
