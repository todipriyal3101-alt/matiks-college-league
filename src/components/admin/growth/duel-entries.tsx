"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setDuelHidden } from "@/app/admin/(panel)/growth/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Entry = { id: string; player_name: string | null; college: string | null; score: number | null; hidden: boolean; via: string | null };

/** Today's named duel entries; Hide keeps a name off the public board. */
export function DuelEntries({ entries, isWriter }: { entries: Entry[]; isWriter: boolean }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();
  if (!entries.length) return <p className="p-3 text-sm text-muted-foreground">No named entries today yet.</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map((e) => {
        const isHidden = hidden[e.id] ?? e.hidden;
        return (
          <li key={e.id} className={cn("glass-surface flex items-center gap-3 rounded-2xl p-3 text-sm", isHidden && "opacity-60")}>
            <span className="w-10 font-mono text-base font-bold">{e.score}</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{e.player_name}</span>
              {e.college && <span className="text-muted-foreground"> · {e.college}</span>}
              {e.via && <span className="text-muted-foreground"> · via {e.via}</span>}
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Hide
              <Switch
                checked={isHidden}
                disabled={!isWriter}
                aria-label={`Hide ${e.player_name} from Top today`}
                onCheckedChange={(v) => {
                  setHidden((h) => ({ ...h, [e.id]: v }));
                  start(async () => {
                    const res = await setDuelHidden(e.id, v);
                    if (!res.ok) {
                      setHidden((h) => ({ ...h, [e.id]: !v }));
                      toast.error(res.error);
                    }
                  });
                }}
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
}
