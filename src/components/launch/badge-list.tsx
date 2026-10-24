import { LockIcon } from "lucide-react";

import { BADGES } from "@/lib/badges";
import { cn } from "@/lib/utils";

/** Earned badges lit up; with `showLocked`, the rest dimmed with how to earn them (POC panel). */
export function BadgeList({ earned, showLocked = false, className }: { earned: readonly string[]; showLocked?: boolean; className?: string }) {
  const list = showLocked ? BADGES : BADGES.filter((b) => earned.includes(b.key));
  if (!list.length) return null;
  return (
    <ul className={cn("grid gap-2.5 sm:grid-cols-2", className)}>
      {list.map((b) => {
        const has = earned.includes(b.key);
        return (
          <li
            key={b.key}
            className={cn(
              "badge-tile flex items-center gap-3 rounded-2xl p-3",
              has ? "bg-primary/10 shadow-[inset_0_0_0_1px_rgb(177_250_99/0.3)]" : "bg-white/4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
            )}
          >
            <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-2xl", has ? "bg-olive" : "bg-white/5 grayscale")}>
              {has ? b.emoji : <LockIcon className="size-4 text-muted-foreground" />}
            </span>
            <span className="min-w-0">
              <span className={cn("block font-semibold", !has && "text-foreground/70")}>{b.label}</span>
              <span className="block text-xs text-muted-foreground">{has ? "Earned" : b.how}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
