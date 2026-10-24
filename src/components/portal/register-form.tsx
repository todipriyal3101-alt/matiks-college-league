"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerMyCollege } from "@/app/college/actions";
import { CollegeSearch } from "@/components/college-search";
import { DetailsFields, SectionLabel, detailsErrors, type DetailsErrors } from "@/components/details-fields";
import { Glass } from "@/components/glass";
import { ContactFieldsForm, contactErrors } from "@/components/portal/contact-fields";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  COUNTRY_LABELS,
  EMPTY_CONTACT_FIELDS,
  EMPTY_DETAILS,
  pocRegisterSchema,
  type ContactFields,
  type Country,
  type DetailsFormValues,
  type PocRegisterInput,
} from "@/lib/validation/portal";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }));

/**
 * Register tab, first visit: the primary POC's own details (name + phone prefilled from sign-up), then the college
 * (type-ahead or new), country, college email + domain, logos, club, dates. Same zod schema as the server.
 */
export function RegisterForm({ userId, email, profile: initialProfile }: { userId: string; email: string; profile: { name: string; phone: string } }) {
  const router = useRouter();
  const [picked, setPicked] = useState<CollegeSearchResult | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<Country>("india");
  const [details, setDetails] = useState<DetailsFormValues>(EMPTY_DETAILS);
  const [contact, setContact] = useState<ContactFields>({ ...EMPTY_CONTACT_FIELDS, name: initialProfile.name, phone: initialProfile.phone, email });
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
      contact,
    };
    const parsed = pocRegisterSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      for (const [k, v] of Object.entries(detailsErrors(parsed.error.issues, "details"))) next[`details.${k}`] ??= v;
      setErrors(next);
      const first = Object.keys(next)[0];
      const id = first === "collegeName" ? "poc-college" : first?.startsWith("contact.") ? `me-${first.slice(8)}` : `reg-${first?.split(".").at(-1)}`;
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
      // The one-time success screen (invite link front and centre).
      router.replace("/college?registered=1");
    });
  }

  return (
    <Glass className="p-5 sm:p-7">
      <form onSubmit={submit} noValidate className="space-y-6">
        {/* The primary POC: the person registering (name + phone from sign-up). */}
        <div className="space-y-3 rounded-2xl bg-lilac/8 p-4 sm:p-5">
          <SectionLabel>You · primary contact</SectionLabel>
          <ContactFieldsForm
            idPrefix="me"
            value={contact}
            onChange={(c) => {
              setContact(c);
              setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("contact."))));
            }}
            errors={contactErrors(Object.entries(errors).map(([k, message]) => ({ path: k.split("."), message })), ["contact"])}
          />
          <p className="text-xs text-muted-foreground">T-shirt, address and pincode can wait; add up to 2 more contacts after you submit.</p>
        </div>

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
