"use client";

import { Loader2Icon, PencilIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerMyCollege } from "@/app/college/actions";
import { CollegeSearch } from "@/components/college-search";
import { DetailsFields, SectionLabel, detailsErrors, type DetailsErrors } from "@/components/details-fields";
import { Glass } from "@/components/glass";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  COUNTRY_LABELS,
  EMPTY_DETAILS,
  pocRegisterSchema,
  type Country,
  type DetailsFormValues,
  type PocRegisterInput,
} from "@/lib/validation/portal";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }));

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/**
 * Register tab, first visit: the college (type-ahead or new), country, college email + domain, logos, club, dates.
 * Name and phone come from sign-up; asked here only when missing. Same zod schema as the server.
 */
export function RegisterForm({ userId, email, profile: initialProfile }: { userId: string; email: string; profile: { name: string; phone: string } }) {
  const [picked, setPicked] = useState<CollegeSearchResult | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<Country>("india");
  const [details, setDetails] = useState<DetailsFormValues>(EMPTY_DETAILS);
  const [profile, setProfile] = useState(initialProfile);
  const [editProfile, setEditProfile] = useState(!initialProfile.name || !initialProfile.phone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const effectiveCountry = picked?.country ?? country;
  const detailErrs: DetailsErrors = Object.fromEntries(
    Object.entries(errors).flatMap(([k, v]) => (k.startsWith("details.") ? [[k.slice(8), v]] : [])),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: PocRegisterInput = {
      collegeId: picked?.id ?? null,
      collegeName: picked?.name ?? newName ?? query,
      country: effectiveCountry,
      details,
      profile,
    };
    const parsed = pocRegisterSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      for (const [k, v] of Object.entries(detailsErrors(parsed.error.issues, "details"))) next[`details.${k}`] ??= v;
      setErrors(next);
      if (Object.keys(next).some((k) => k.startsWith("profile."))) setEditProfile(true);
      const first = Object.keys(next)[0];
      const id = first === "collegeName" ? "poc-college" : first?.startsWith("profile.") ? `poc-${first.slice(8)}` : `reg-${first?.split(".").at(-1)}`;
      setTimeout(() => document.getElementById(id)?.focus(), 0);
      toast.error("Fix the highlighted fields");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await registerMyCollege(input);
      if (!res.ok) {
        if (res.field) setErrors({ [res.field]: res.error });
        toast.error(res.error);
        return;
      }
      toast.success("Registered! A Matiks admin will review it soon.");
    });
  }

  return (
    <Glass className="p-5 sm:p-7">
      <form onSubmit={submit} noValidate className="space-y-6">
        {/* Who's registering (from sign-up) */}
        {editProfile ? (
          <div className="space-y-3 rounded-2xl bg-lilac/10 p-4">
            <SectionLabel>You (primary contact)</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={!!errors["profile.name"]}>
                <FieldLabel htmlFor="poc-name">Your name</FieldLabel>
                <Input id="poc-name" autoComplete="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="h-12" />
                <FieldError>{errors["profile.name"]}</FieldError>
              </Field>
              <Field data-invalid={!!errors["profile.phone"]}>
                <FieldLabel htmlFor="poc-phone">Phone (WhatsApp)</FieldLabel>
                <Input id="poc-phone" type="tel" inputMode="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="h-12 font-mono" />
                <FieldError>{errors["profile.phone"]}</FieldError>
              </Field>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-lilac/10 p-3 sm:p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac text-sm font-bold text-background">{initials(profile.name)}</span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-sans font-bold">{profile.name}</span>
              <span className="block truncate text-muted-foreground">
                <span className="font-mono">{profile.phone}</span> · {email}
              </span>
            </p>
            <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => setEditProfile(true)}>
              <PencilIcon /> Edit
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <SectionLabel>College</SectionLabel>
          <Field data-invalid={!!errors.collegeName}>
            <FieldLabel htmlFor="poc-college">College name</FieldLabel>
            {newName ? (
              <div className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-black/25 pr-1.5 pl-3.5">
                <span className="min-w-0 flex-1 truncate">{newName}</span>
                <span className="rounded-full bg-lilac/15 px-2 py-0.5 text-xs font-semibold text-lilac">New college</span>
                <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Pick another college" onClick={() => setNewName(null)}>
                  <XIcon />
                </Button>
              </div>
            ) : (
              <CollegeSearch
                id="poc-college"
                selectedId={picked?.id ?? null}
                selectedLabel={picked?.name ?? ""}
                invalid={!!errors.collegeName}
                onSelect={(c) => {
                  setPicked(c);
                  setErrors((e) => ({ ...e, collegeName: "" }));
                }}
                onQueryChange={(q) => {
                  setQuery(q);
                  if (picked) setPicked(null);
                }}
                onAddNew={(name) => {
                  setNewName(name);
                  setPicked(null);
                  setErrors((e) => ({ ...e, collegeName: "" }));
                }}
              />
            )}
            <FieldError>{errors.collegeName}</FieldError>
          </Field>
          <Field>
            <FieldLabel>Country</FieldLabel>
            <SegmentedControl label="Country" className="self-start" options={COUNTRY_OPTIONS} value={effectiveCountry} onChange={setCountry} disabled={!!picked} />
          </Field>
        </div>

        <DetailsFields
          idPrefix="reg"
          folder={`users/${userId}`}
          value={details}
          onChange={(d) => {
            setDetails(d);
            setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("details."))));
          }}
          errors={detailErrs}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground sm:max-w-sm">You can edit these details until a Matiks admin approves your college.</p>
          <Button type="submit" className="h-12 rounded-full px-7" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Submit for review
          </Button>
        </div>
      </form>
    </Glass>
  );
}
