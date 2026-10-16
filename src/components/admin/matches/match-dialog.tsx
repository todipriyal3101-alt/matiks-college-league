"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMatch } from "@/app/admin/(panel)/matches/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MatchFormValues = {
  id?: string;
  round: string;
  collegeAId: string;
  collegeBId: string;
  scheduledAt: string;
  scoreA: string;
  scoreB: string;
  winner: "a" | "b" | "none";
};

/** Winner from the scores when they differ; otherwise keep what was chosen. */
function autoWinner(v: MatchFormValues): MatchFormValues["winner"] {
  if (v.scoreA === "" || v.scoreB === "") return v.winner;
  const a = Number(v.scoreA);
  const b = Number(v.scoreB);
  return a > b ? "a" : b > a ? "b" : "none";
}

export function MatchDialog({
  leagueId,
  colleges,
  rounds,
  initial,
  onClose,
}: {
  leagueId: string;
  colleges: { id: string; name: string }[];
  rounds: string[];
  initial: MatchFormValues;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<MatchFormValues>) =>
    setV((s) => {
      const next = { ...s, ...patch };
      return "scoreA" in patch || "scoreB" in patch ? { ...next, winner: autoWinner(next) } : next;
    });
  const name = (id: string) => colleges.find((c) => c.id === id)?.name ?? "College";

  const collegeSelect = (key: "collegeAId" | "collegeBId", label: string) => (
    <Field>
      <FieldLabel htmlFor={`m-${key}`}>{label}</FieldLabel>
      <Select value={v[key] || undefined} onValueChange={(id) => set({ [key]: id })}>
        <SelectTrigger id={`m-${key}`} className="w-full">
          <SelectValue placeholder="Select college" />
        </SelectTrigger>
        <SelectContent>
          {colleges.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await saveMatch({ ...v, leagueId });
              if (!res.ok) return setError(res.error);
              toast.success(v.id ? "Match saved" : "Fixture added");
              onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{v.id ? "Edit match" : "Add fixture"}</DialogTitle>
            <DialogDescription>Between approved colleges of this season. Times are IST.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="m-round">Round</FieldLabel>
                <Input id="m-round" list="m-rounds" placeholder="Group A, Quarterfinal…" value={v.round} onChange={(e) => set({ round: e.target.value })} />
                <datalist id="m-rounds">
                  {rounds.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field>
                <FieldLabel htmlFor="m-when">Scheduled</FieldLabel>
                <Input id="m-when" type="datetime-local" value={v.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {collegeSelect("collegeAId", "College A")}
              {collegeSelect("collegeBId", "College B")}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="m-sa">Score A</FieldLabel>
                <Input id="m-sa" type="number" min={0} inputMode="numeric" className="font-mono" value={v.scoreA} onChange={(e) => set({ scoreA: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-sb">Score B</FieldLabel>
                <Input id="m-sb" type="number" min={0} inputMode="numeric" className="font-mono" value={v.scoreB} onChange={(e) => set({ scoreB: e.target.value })} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="m-winner">Winner</FieldLabel>
              <Select value={v.winner} onValueChange={(w) => set({ winner: w as MatchFormValues["winner"] })}>
                <SelectTrigger id="m-winner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not decided / draw</SelectItem>
                  {v.collegeAId && <SelectItem value="a">{name(v.collegeAId)}</SelectItem>}
                  {v.collegeBId && <SelectItem value="b">{name(v.collegeBId)}</SelectItem>}
                </SelectContent>
              </Select>
              <FieldDescription>Filled in from the scores; change it if needed.</FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !v.round || !v.collegeAId || !v.collegeBId}>
              {pending && <Loader2Icon className="animate-spin" />}
              {v.id ? "Save match" : "Add fixture"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
