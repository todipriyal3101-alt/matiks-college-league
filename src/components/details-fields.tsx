"use client";

import { LogoUpload } from "@/components/logo-upload";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DetailsFormValues } from "@/lib/validation/portal";

/** Error keys are the DetailsFormValues keys ("emailDomain", "leagueEnd", …). */
export type DetailsErrors = Partial<Record<keyof DetailsFormValues, string>>;

/** Small caps section label in lilac, as in the Register mockup. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-sans text-xs font-bold tracking-[0.12em] text-lilac normal-case">{children}</h2>;
}

/**
 * The registration details a POC fills in (Register tab) and admins edit (Add college, college editor):
 * college email + domain, college logo, "Hosted by" club + logo, and the three dates.
 */
export function DetailsFields({
  value,
  onChange,
  errors = {},
  folder,
  disabled,
  idPrefix = "details",
}: {
  value: DetailsFormValues;
  onChange: (next: DetailsFormValues) => void;
  errors?: DetailsErrors;
  /** Storage folder for logo uploads. */
  folder: string;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const set = <K extends keyof DetailsFormValues>(key: K, v: DetailsFormValues[K]) => onChange({ ...value, [key]: v });
  const id = (k: string) => `${idPrefix}-${k}`;
  const text = (key: "collegeEmail" | "emailDomain" | "clubName" | "registrationStart" | "leagueStart" | "leagueEnd") => ({
    id: id(key),
    value: value[key],
    disabled,
    "aria-invalid": !!errors[key] || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    className: "h-12",
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.collegeEmail}>
          <FieldLabel htmlFor={id("collegeEmail")}>College email ID</FieldLabel>
          <Input type="email" inputMode="email" autoComplete="off" placeholder="sports@iitg.ac.in" {...text("collegeEmail")} />
          <FieldError>{errors.collegeEmail}</FieldError>
        </Field>
        <Field data-invalid={!!errors.emailDomain}>
          <FieldLabel htmlFor={id("emailDomain")}>College email domain</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-muted-foreground" aria-hidden>
              @
            </span>
            <Input
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="iitg.ac.in"
              {...text("emailDomain")}
              onChange={(e) => set("emailDomain", e.target.value.replace(/^@+/, "").toLowerCase())}
              className="h-12 pl-8"
            />
          </div>
          <FieldDescription>Student and staff emails end with this.</FieldDescription>
          <FieldError>{errors.emailDomain}</FieldError>
        </Field>
      </div>

      <div className="space-y-3">
        <SectionLabel>Logos</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <LogoUpload folder={folder} name="college" label="College logo" value={value.collegeLogoUrl} onChange={(url) => set("collegeLogoUrl", url)} disabled={disabled} invalid={!!errors.collegeLogoUrl} />
            {errors.collegeLogoUrl && <p className="text-sm text-destructive">{errors.collegeLogoUrl}</p>}
          </div>
          <div className="space-y-2">
            <LogoUpload folder={folder} name="club" label="Club logo (Hosted by)" value={value.clubLogoUrl} onChange={(url) => set("clubLogoUrl", url)} disabled={disabled} invalid={!!errors.clubLogoUrl} />
            <Field data-invalid={!!errors.clubName}>
              <FieldLabel htmlFor={id("clubName")} className="sr-only">
                Club name
              </FieldLabel>
              <Input placeholder="Club name, e.g. Coding Club" autoComplete="off" {...text("clubName")} />
              <FieldError>{errors.clubName}</FieldError>
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>Dates</SectionLabel>
        <Field data-invalid={!!errors.registrationStart}>
          <FieldLabel htmlFor={id("registrationStart")}>Registration start date</FieldLabel>
          <Input type="date" {...text("registrationStart")} />
          <FieldError>{errors.registrationStart}</FieldError>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Field data-invalid={!!errors.leagueStart}>
            <FieldLabel htmlFor={id("leagueStart")}>League start</FieldLabel>
            <Input type="date" min={value.registrationStart || undefined} {...text("leagueStart")} />
            <FieldError>{errors.leagueStart}</FieldError>
          </Field>
          <Field data-invalid={!!errors.leagueEnd}>
            <FieldLabel htmlFor={id("leagueEnd")}>League end</FieldLabel>
            <Input type="date" min={value.leagueStart || undefined} {...text("leagueEnd")} />
            <FieldError>{errors.leagueEnd}</FieldError>
          </Field>
        </div>
      </div>
    </div>
  );
}

/** zod issues → { field: message } for DetailsFields (paths like ["details", "leagueEnd"] use the last key). */
export function detailsErrors(issues: readonly { path: PropertyKey[]; message: string }[], prefix?: string): DetailsErrors {
  const out: DetailsErrors = {};
  for (const issue of issues) {
    if (prefix && issue.path[0] !== prefix) continue;
    const key = String(issue.path.at(-1)) as keyof DetailsFormValues;
    out[key] ??= issue.message;
  }
  return out;
}
