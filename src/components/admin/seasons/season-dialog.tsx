"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSeason } from "@/app/admin/(panel)/leagues/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/lib/database.types";

/** Form state: what the inputs hold (numbers may still be strings while typing). */
export type SeasonFormValues = {
  id?: string;
  name: string;
  slug: string;
  season: number | string;
  startDate: string;
  endDate: string;
  deadline: string;
  maxColleges: number | string;
  status: Database["public"]["Enums"]["league_status"];
  registrationOpen: boolean;
};

const STATUS_HELP = {
  draft: "Hidden from the public site.",
  upcoming: "Public; registrations can be open.",
  live: "League in progress.",
  completed: "Finished; kept for history.",
} as const;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function SeasonDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SeasonFormValues;
}) {
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof SeasonFormValues>(k: K, value: SeasonFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await saveSeason(v);
              if (!res.ok) return setError(res.error);
              toast.success(v.id ? "Season saved" : `${v.name} created`);
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{v.id ? `Edit ${initial.name}` : "New season"}</DialogTitle>
            <DialogDescription>Dates and deadline are in India time (IST).</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
              <Field>
                <FieldLabel htmlFor="s-name">Name</FieldLabel>
                <Input
                  id="s-name"
                  value={v.name}
                  placeholder="Brumble 3.0"
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-season">Season #</FieldLabel>
                <Input id="s-season" type="number" min={1} value={v.season} onChange={(e) => set("season", e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="s-slug">Slug</FieldLabel>
              <Input id="s-slug" className="font-mono" value={v.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="s-start">Start date</FieldLabel>
                <Input id="s-start" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-end">End date</FieldLabel>
                <Input id="s-end" type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="s-deadline">Registration deadline</FieldLabel>
                <Input id="s-deadline" type="datetime-local" value={v.deadline} onChange={(e) => set("deadline", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-max">Max colleges</FieldLabel>
                <Input id="s-max" type="number" min={1} placeholder="No limit" value={v.maxColleges} onChange={(e) => set("maxColleges", e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="s-status">Status</FieldLabel>
              <Select value={v.status} onValueChange={(s) => set("status", s as SeasonFormValues["status"])}>
                <SelectTrigger id="s-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_HELP) as (keyof typeof STATUS_HELP)[]).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{STATUS_HELP[v.status]}</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Switch id="s-open" checked={v.registrationOpen} onCheckedChange={(c) => set("registrationOpen", c)} />
              <FieldLabel htmlFor="s-open">Registration open</FieldLabel>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {v.id ? "Save season" : "Create season"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
