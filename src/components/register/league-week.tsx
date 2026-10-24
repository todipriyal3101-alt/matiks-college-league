"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY));

const chip = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The next four Mondays, a week out at least, as quick picks. */
function mondays(today: string) {
  const t = new Date(`${today}T00:00:00Z`);
  const first = new Date(t.getTime() + (((8 - t.getUTCDay()) % 7) + 7) * DAY);
  return Array.from({ length: 4 }, (_, i) => iso(new Date(first.getTime() + i * 7 * DAY)));
}

/**
 * "Pick your 7-day league week": one start date, end = start + 6. "Custom dates" opens the end date and the
 * registration start (defaults to today).
 */
export function LeagueWeek({
  registrationStart,
  leagueStart,
  leagueEnd,
  custom,
  onChange,
  errors,
  today,
}: {
  registrationStart: string;
  leagueStart: string;
  leagueEnd: string;
  custom: boolean;
  onChange: (next: { registrationStart: string; leagueStart: string; leagueEnd: string; custom: boolean }) => void;
  errors: { registrationStart?: string; leagueStart?: string; leagueEnd?: string };
  today: string;
}) {
  const pick = (start: string) =>
    onChange({ registrationStart: registrationStart || today, leagueStart: start, leagueEnd: custom && leagueEnd >= start ? leagueEnd : start ? addDays(start, 6) : "", custom });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Quick picks">
        {mondays(today).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pick(d)}
            aria-pressed={leagueStart === d}
            className={cn(
              "glass-surface min-h-14 rounded-2xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/8",
              leagueStart === d && "bg-primary/12 shadow-[inset_0_0_0_1.5px_rgb(177_250_99/0.6)]",
            )}
          >
            <span className="block font-bold">{chip.format(new Date(`${d}T00:00:00Z`))}</span>
            <span className="text-xs text-muted-foreground">to {chip.format(new Date(`${addDays(d, 6)}T00:00:00Z`))}</span>
          </button>
        ))}
      </div>

      <Field data-invalid={!!errors.leagueStart}>
        <FieldLabel htmlFor="week-start">Or pick the first day</FieldLabel>
        <Input id="week-start" type="date" min={registrationStart || today} value={leagueStart} onChange={(e) => pick(e.target.value)} className="h-12" aria-invalid={!!errors.leagueStart || undefined} />
        <FieldError>{errors.leagueStart}</FieldError>
      </Field>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/4 px-4 py-3 text-sm font-semibold">
        Custom dates
        <Switch
          checked={custom}
          onCheckedChange={(v) => onChange({ registrationStart: registrationStart || today, leagueStart, leagueEnd: !v && leagueStart ? addDays(leagueStart, 6) : leagueEnd, custom: v })}
        />
      </label>

      {custom && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={!!errors.leagueEnd}>
            <FieldLabel htmlFor="week-end">League end</FieldLabel>
            <Input id="week-end" type="date" min={leagueStart || undefined} value={leagueEnd} onChange={(e) => onChange({ registrationStart, leagueStart, leagueEnd: e.target.value, custom })} className="h-12" aria-invalid={!!errors.leagueEnd || undefined} />
            <FieldError>{errors.leagueEnd}</FieldError>
          </Field>
          <Field data-invalid={!!errors.registrationStart}>
            <FieldLabel htmlFor="week-reg">Registration opens</FieldLabel>
            <Input id="week-reg" type="date" value={registrationStart} onChange={(e) => onChange({ registrationStart: e.target.value, leagueStart, leagueEnd, custom })} className="h-12" aria-invalid={!!errors.registrationStart || undefined} />
            <FieldError>{errors.registrationStart}</FieldError>
          </Field>
        </div>
      )}
    </div>
  );
}
