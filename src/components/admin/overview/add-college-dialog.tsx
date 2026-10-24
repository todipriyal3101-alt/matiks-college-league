"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addCollege } from "@/app/admin/(panel)/overview-actions";
import { CollegeSearch } from "@/components/college-search";
import { DetailsFields, SectionLabel } from "@/components/details-fields";
import { SegmentedControl } from "@/components/segmented-control";
import { AccessMessageDialog } from "@/components/admin/access-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/indian-states";
import { addCollegeSchema, type AddCollegeInput } from "@/lib/validation/league-ops";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_LABELS, EMPTY_DETAILS, type Country, type DetailsFormValues } from "@/lib/validation/portal";

const EMPTY_COLLEGE = { name: "", city: "", state: "" };
const EMPTY_POC = { name: "", phone: "", email: "" };
/** Field error keys are zod paths: "collegeId", "newCollege.city", "poc.phone", … */
type Errors = Record<string, string>;

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }));

export function AddCollegeDialog({ leagueId, leagueName, defaultCountry = "india" }: { leagueId: string; leagueName: string; defaultCountry?: Country }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [college, setCollege] = useState(EMPTY_COLLEGE);
  const [poc, setPoc] = useState(EMPTY_POC);
  const [invitePoc, setInvitePoc] = useState(true);
  const [share, setShare] = useState<string | null>(null);
  const [country, setCountry] = useState<Country>(defaultCountry);
  const [details, setDetails] = useState<DetailsFormValues>(EMPTY_DETAILS);
  // Admin uploads go to their own folder; the registration doesn't exist until Save.
  const [uploadFolder] = useState(() => `admin/${crypto.randomUUID()}`);

  function reset() {
    setErrors({});
    setFormError(null);
    setPicked(null);
    setNotListed(false);
    setCollege(EMPTY_COLLEGE);
    setPoc(EMPTY_POC);
    setInvitePoc(true);
    setCountry(defaultCountry);
    setDetails(EMPTY_DETAILS);
  }

  /** Clears a field's error as soon as it's edited. */
  function clear(key: string) {
    if (errors[key]) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
  }

  /** Focuses the first invalid field in screen order (zod lists the college refine last). */
  function focusFirst(keys: string[]) {
    const ids: Record<string, string> = {
      collegeId: "college-search",
      "newCollege.name": "new-college-name",
      "newCollege.city": "new-college-city",
      "newCollege.state": "new-college-state",
      "poc.name": "poc-name",
      "poc.phone": "poc-phone",
      "poc.email": "poc-email",
    };
    const details = keys.find((k) => k.startsWith("details."));
    const id = Object.entries(ids).find(([key]) => keys.includes(key))?.[1] ?? (details && `add-${details.slice(8)}`);
    if (id) document.getElementById(id)?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input: AddCollegeInput = {
      leagueId,
      collegeId: notListed ? null : (picked?.id ?? null),
      newCollege: notListed ? college : null,
      poc,
      invitePoc,
      details: { ...details, country },
    };
    // Same schema as the server: every field error shows at once, inline.
    const parsed = addCollegeSchema.safeParse(input);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      focusFirst(Object.keys(next));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await addCollege(input);
      if (!res.ok) {
        if (res.field) {
          setErrors({ [res.field]: res.error });
          focusFirst([res.field]);
        } else setFormError(res.error);
        return;
      }
      toast.success("College added", {
        description: res.message || undefined,
        action: { label: "Open", onClick: () => router.push(`/admin/colleges/${res.registrationId}`) },
      });
      setOpen(false);
      reset();
      if (res.whatsapp) setShare(res.whatsapp);
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <PlusIcon /> Add college
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add college</DialogTitle>
            <DialogDescription>Adds it to {leagueName} as approved, with its primary POC.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel>Country</FieldLabel>
                <SegmentedControl label="Country" options={COUNTRY_OPTIONS} value={country} onChange={setCountry} className="self-start" />
              </Field>
              {!notListed ? (
                <Field data-invalid={!!errors.collegeId}>
                  <FieldLabel htmlFor="college-search">College</FieldLabel>
                  <CollegeSearch
                    selectedId={picked?.id ?? null}
                    selectedLabel={picked?.name ?? ""}
                    invalid={!!errors.collegeId}
                    onSelect={(c) => {
                      setPicked({ id: c.id, name: c.name });
                      clear("collegeId");
                    }}
                    onQueryChange={(q) => {
                      if (picked) setPicked(null);
                      setCollege((c) => ({ ...c, name: q }));
                    }}
                  />
                  <FieldError>{errors.collegeId}</FieldError>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto self-start p-0"
                    onClick={() => {
                      setNotListed(true);
                      clear("collegeId");
                    }}
                  >
                    College isn&apos;t listed? Add it
                  </Button>
                </Field>
              ) : (
                <>
                  <Field data-invalid={!!errors["newCollege.name"]}>
                    <FieldLabel htmlFor="new-college-name">College name</FieldLabel>
                    <Input
                      id="new-college-name"
                      value={college.name}
                      aria-invalid={!!errors["newCollege.name"]}
                      onChange={(e) => {
                        setCollege({ ...college, name: e.target.value });
                        clear("newCollege.name");
                      }}
                      placeholder="Indian Institute of Technology Bombay"
                    />
                    <FieldError>{errors["newCollege.name"]}</FieldError>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={!!errors["newCollege.city"]}>
                      <FieldLabel htmlFor="new-college-city">City</FieldLabel>
                      <Input
                        id="new-college-city"
                        value={college.city}
                        aria-invalid={!!errors["newCollege.city"]}
                        onChange={(e) => {
                          setCollege({ ...college, city: e.target.value });
                          clear("newCollege.city");
                        }}
                      />
                      <FieldError>{errors["newCollege.city"]}</FieldError>
                    </Field>
                    <Field data-invalid={!!errors["newCollege.state"]}>
                      <FieldLabel htmlFor="new-college-state">State</FieldLabel>
                      {country === "india" ? (
                        <Select
                          value={college.state || undefined}
                          onValueChange={(v) => {
                            setCollege({ ...college, state: v });
                            clear("newCollege.state");
                          }}
                        >
                          <SelectTrigger id="new-college-state" className="w-full" aria-invalid={!!errors["newCollege.state"]}>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {INDIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="new-college-state"
                          value={college.state}
                          placeholder="e.g. California"
                          aria-invalid={!!errors["newCollege.state"]}
                          onChange={(e) => {
                            setCollege({ ...college, state: e.target.value });
                            clear("newCollege.state");
                          }}
                        />
                      )}
                      <FieldError>{errors["newCollege.state"]}</FieldError>
                    </Field>
                  </div>
                  <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => setNotListed(false)}>
                    Search the list instead
                  </Button>
                </>
              )}

              <div className="space-y-3">
                <SectionLabel>League details (optional)</SectionLabel>
                <DetailsFields
                  idPrefix="add"
                  folder={uploadFolder}
                  value={details}
                  onChange={(d) => {
                    setDetails(d);
                    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("details."))));
                  }}
                  errors={Object.fromEntries(
                    Object.entries(errors).flatMap(([k, v]) => (k.startsWith("details.") ? [[k.slice(8), v]] : [])),
                  )}
                />
              </div>

              <FieldSeparator>Primary POC</FieldSeparator>
              <Field data-invalid={!!errors["poc.name"]}>
                <FieldLabel htmlFor="poc-name">Name</FieldLabel>
                <Input
                  id="poc-name"
                  value={poc.name}
                  aria-invalid={!!errors["poc.name"]}
                  onChange={(e) => {
                    setPoc({ ...poc, name: e.target.value });
                    clear("poc.name");
                  }}
                  autoComplete="off"
                />
                <FieldError>{errors["poc.name"]}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors["poc.phone"]}>
                  <FieldLabel htmlFor="poc-phone">Phone</FieldLabel>
                  <Input
                    id="poc-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={20}
                    value={poc.phone}
                    aria-invalid={!!errors["poc.phone"]}
                    onChange={(e) => {
                      setPoc({ ...poc, phone: e.target.value });
                      clear("poc.phone");
                    }}
                    placeholder={country === "india" ? "10-digit mobile" : "+1 555 123 4567"}
                    className="font-mono"
                  />
                  <FieldError>{errors["poc.phone"]}</FieldError>
                </Field>
                <Field data-invalid={!!errors["poc.email"]}>
                  <FieldLabel htmlFor="poc-email">Email</FieldLabel>
                  <Input
                    id="poc-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={poc.email}
                    aria-invalid={!!errors["poc.email"]}
                    onChange={(e) => {
                      setPoc({ ...poc, email: e.target.value });
                      clear("poc.email");
                    }}
                    placeholder="For portal access"
                  />
                  <FieldError>{errors["poc.email"]}</FieldError>
                </Field>
              </div>
              <Field orientation="horizontal">
                <Checkbox id="poc-invite" checked={invitePoc} onCheckedChange={(v) => setInvitePoc(v === true)} />
                <FieldLabel htmlFor="poc-invite" className="font-normal">
                  Give portal access
                </FieldLabel>
              </Field>
              {formError && (
                <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </p>
              )}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={pending} className="h-11 sm:h-9">
                {pending && <Loader2Icon className="animate-spin" />}
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AccessMessageDialog message={share} onClose={() => setShare(null)} />
    </>
  );
}
