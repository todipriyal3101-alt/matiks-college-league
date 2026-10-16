"use client";

import { PencilIcon, PlusIcon, SwordsIcon, Trash2Icon, TrophyIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteMatch } from "@/app/admin/(panel)/matches/actions";
import { EmptyState } from "@/components/league/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";
import { istDateTime, toIstInput } from "@/lib/ist";
import { cn } from "@/lib/utils";

import { MatchDialog, type MatchFormValues } from "./match-dialog";

type Match = Tables<"matches">;

export function MatchesList({
  leagueId,
  matches,
  colleges,
  allColleges,
  isWriter,
}: {
  leagueId: string;
  matches: Match[];
  /** Approved colleges of the season (pickable). */
  colleges: { id: string; name: string }[];
  /** Every college referenced by a match (names). */
  allColleges: Record<string, string>;
  isWriter: boolean;
}) {
  const [editing, setEditing] = useState<MatchFormValues | null>(null);
  const [toDelete, setToDelete] = useState<Match | null>(null);
  const [, startTransition] = useTransition();
  const rounds = [...new Set(matches.map((m) => m.round))];
  const name = (id: string) => allColleges[id] ?? "Unknown college";

  return (
    <div className="space-y-6">
      {isWriter && (
        <div className="flex items-center justify-end gap-3">
          {colleges.length < 2 && <p className="text-sm text-muted-foreground">Approve at least 2 colleges to schedule matches.</p>}
          <Button
            disabled={colleges.length < 2}
            onClick={() => setEditing({ round: rounds.at(-1) ?? "", collegeAId: "", collegeBId: "", scheduledAt: "", scoreA: "", scoreB: "", winner: "none" })}
          >
            <PlusIcon /> Add fixture
          </Button>
        </div>
      )}
      {matches.length === 0 ? (
        <EmptyState icon={SwordsIcon} title="No fixtures yet" description="Add fixtures between approved colleges; they appear on the public /fixtures page." />
      ) : (
        rounds.map((round) => (
          <section key={round} className="space-y-2">
            <h2 className="font-display text-lg font-semibold">{round}</h2>
            <ul className="divide-y divide-border/60 rounded-xl border bg-card">
              {matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="grid min-w-0 flex-1 basis-72 grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <Side name={name(m.college_a_id)} score={m.score_a} winner={m.winner_id === m.college_a_id} />
                      <span className="text-xs text-muted-foreground">vs</span>
                      <Side name={name(m.college_b_id)} score={m.score_b} winner={m.winner_id === m.college_b_id} alignEnd />
                    </div>
                    <p className="basis-40 font-mono text-xs text-muted-foreground">
                      {m.scheduled_at ? istDateTime.format(new Date(m.scheduled_at)) : "Not scheduled"}
                    </p>
                    {isWriter && (
                      <div className="ml-auto flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Edit match"
                          onClick={() =>
                            setEditing({
                              id: m.id,
                              round: m.round,
                              collegeAId: m.college_a_id,
                              collegeBId: m.college_b_id,
                              scheduledAt: toIstInput(m.scheduled_at),
                              scoreA: m.score_a?.toString() ?? "",
                              scoreB: m.score_b?.toString() ?? "",
                              winner: m.winner_id === m.college_a_id ? "a" : m.winner_id === m.college_b_id ? "b" : "none",
                            })
                          }
                        >
                          <PencilIcon />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Delete match" onClick={() => setToDelete(m)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
      {editing && (
        <MatchDialog
          key={editing.id ?? "new"}
          leagueId={leagueId}
          // Keep already-scheduled colleges pickable even if no longer approved.
          colleges={[
            ...colleges,
            ...[editing.collegeAId, editing.collegeBId]
              .filter((id) => id && !colleges.some((c) => c.id === id))
              .map((id) => ({ id, name: name(id) })),
          ]}
          rounds={rounds}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `${name(toDelete.college_a_id)} vs ${name(toDelete.college_b_id)} (${toDelete.round}) will be removed from /fixtures too.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const m = toDelete!;
                setToDelete(null);
                startTransition(async () => {
                  const res = await deleteMatch(m.id);
                  if (res.ok) toast.success("Match deleted");
                  else toast.error(res.error);
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Side({ name, score, winner, alignEnd }: { name: string; score: number | null; winner: boolean; alignEnd?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", alignEnd && "flex-row-reverse text-right")}>
      <span className={cn("truncate text-sm", winner && "font-semibold text-primary")}>
        {winner && <TrophyIcon className="mr-1 inline size-3.5" />}
        {name}
      </span>
      <span className="font-mono text-lg tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
