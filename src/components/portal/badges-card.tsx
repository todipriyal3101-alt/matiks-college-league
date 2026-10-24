"use client";

import { MedalIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Glass } from "@/components/glass";
import { BadgeList } from "@/components/launch/badge-list";
import { BADGES } from "@/lib/badges";
import { confetti } from "@/lib/confetti";

const seenKey = (id: string) => `mcl_badges_seen_${id}`;

/**
 * Badges in the POC panel (earned + locked with how to earn). A new badge since this device last looked: confetti +
 * a toast (once per device; the database also sent a notification). Approval itself is celebrated by the tracker.
 */
export function BadgesCard({ registrationId, earned }: { registrationId: string; earned: string[] }) {
  useEffect(() => {
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey(registrationId)) ?? "[]"));
      const fresh = earned.filter((b) => !seen.has(b));
      if (fresh.length) localStorage.setItem(seenKey(registrationId), JSON.stringify(earned));
      if (!fresh.length) return;
      const id = setTimeout(() => {
        confetti();
        for (const b of fresh) {
          const def = BADGES.find((x) => x.key === b);
          if (def) toast.success(`Badge earned: ${def.emoji} ${def.label}`);
        }
      }, 400);
      return () => clearTimeout(id);
    } catch {}
  }, [registrationId, earned]);

  return (
    <Glass className="space-y-3 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold normal-case">
          <MedalIcon className="size-4 text-primary" aria-hidden /> Badges
        </h2>
        <span className="font-mono text-sm text-muted-foreground">
          {earned.length}/{BADGES.length}
        </span>
      </div>
      <BadgeList earned={earned} showLocked />
      <p className="text-xs text-muted-foreground">Badges show on your public college page.</p>
    </Glass>
  );
}
