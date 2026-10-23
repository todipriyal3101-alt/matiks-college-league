"use client";

import { PencilIcon, PlusIcon, TrophyIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Tables } from "@/lib/database.types";
import { istDate, toIstInput } from "@/lib/ist";
import { cn } from "@/lib/utils";

import { SeasonDialog, type SeasonFormValues } from "./season-dialog";

type Season = Tables<"leagues"> & { registrations: number };

const STATUS_STYLE: Record<Season["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  upcoming: "bg-status-registration text-status-registration-fg",
  live: "bg-status-live text-status-live-fg",
  completed: "bg-status-done text-status-done-fg",
};

const toForm = (s: Season): SeasonFormValues => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  season: s.season,
  startDate: s.start_date ?? "",
  endDate: s.end_date ?? "",
  deadline: toIstInput(s.registration_deadline),
  maxColleges: s.max_colleges ?? "",
  status: s.status,
});

export function SeasonsList({ seasons, isWriter }: { seasons: Season[]; isWriter: boolean }) {
  const [editing, setEditing] = useState<SeasonFormValues | null>(null);
  const nextNumber = Math.max(0, ...seasons.map((s) => s.season)) + 1;

  return (
    <div className="space-y-4">
      {isWriter && (
        <div className="flex justify-end">
          <Button
            onClick={() =>
              setEditing({ name: "", slug: "", season: nextNumber, startDate: "", endDate: "", deadline: "", maxColleges: "", status: "draft" })
            }
          >
            <PlusIcon /> New season
          </Button>
        </div>
      )}
      {seasons.length === 0 ? (
        <EmptyState icon={TrophyIcon} title="No seasons yet" description="The first POC registration creates “Matiks College League – Season 1” automatically, or create one now." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {seasons.map((s) => {
            return (
              <Card key={s.id} className="gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-wider text-muted-foreground uppercase">Season {s.season}</p>
                    <h2 className="text-3xl">{s.name}</h2>
                    <p className="font-mono text-xs text-muted-foreground">/{s.slug}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[s.status])}>{s.status}</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Dates</dt>
                    <dd>{s.start_date ? `${istDate.format(new Date(s.start_date))} – ${s.end_date ? istDate.format(new Date(s.end_date)) : "?"}` : "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Colleges</dt>
                    <dd className="font-mono">
                      {s.registrations}
                      {s.max_colleges ? ` / ${s.max_colleges}` : ""}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
                  {isWriter && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(toForm(s))}>
                      <PencilIcon /> Edit
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <SeasonDialog key={editing.id ?? "new"} open onOpenChange={(o) => !o && setEditing(null)} initial={editing} />}
    </div>
  );
}
