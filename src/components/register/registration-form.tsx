"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";

import { submitRegistration } from "@/app/(public)/register/actions";
import { CollegeSearch } from "@/components/register/college-search";
import { Turnstile } from "@/components/register/turnstile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/indian-states";
import {
  YEARS,
  registrationSchema,
  type RegistrationData,
  type RegistrationInput,
  type RegistrationResult,
} from "@/lib/validation/registration";
import { cn } from "@/lib/utils";

// Two steps: (1) college + you, (2) optional teammates + consent + captcha. Target: under a minute on a phone.
const STEPS = [
  { title: "College & you", fields: ["college", "poc"] },
  { title: "Finish", fields: ["team", "review"] },
] as const satisfies { title: string; fields: FieldPath<RegistrationInput>[] }[];

const YEAR_LABELS: Record<(typeof YEARS)[number], string> = {
  "1st year": "1st",
  "2nd year": "2nd",
  "3rd year": "3rd",
  "4th year": "4th",
  "5th year": "5th",
  Postgraduate: "PG",
  Other: "Other",
};

const DEFAULT_VALUES: RegistrationInput = {
  college: {
    collegeId: null,
    collegeLabel: "",
    notListed: false,
    newCollege: { name: "", city: "", state: "", type: "other" },
  },
  poc: { name: "", email: "", phone: "", year: undefined as never, course: "", matiksUsername: "" },
  team: { teamName: "", teammates: [] },
  review: { consent: false as never, turnstileToken: "" },
};

const input = "h-12 text-base";

export function RegistrationForm({ leagueName }: { leagueName: string }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const form = useForm<RegistrationInput, unknown, RegistrationData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });
  const { control, register, setValue, watch, trigger, formState } = form;
  const errors = formState.errors;
  const teammates = useFieldArray({ control, name: "team.teammates" });

  const notListed = watch("college.notListed");
  const isLast = step === STEPS.length - 1;

  async function next() {
    if (!(await trigger(STEPS[step].fields, { shouldFocus: true }))) return;
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSubmit = form.handleSubmit((data) => {
    setServerError(null);
    startTransition(async () => {
      const res = await submitRegistration(data);
      // Success redirects to /register/success, so we only get here on a non-success result.
      // Turnstile tokens are single-use: reset the widget for a retry.
      setValue("review.turnstileToken", "");
      setCaptchaKey((k) => k + 1);
      if (res.status === "error") setServerError(res.message);
      else setResult(res);
    });
  });

  if (result?.status === "already_registered") {
    return (
      <Notice title={`${result.collegeName} is already in`}>
        {result.pocFirstName ? `${result.pocFirstName} registered` : "Someone registered"} your college for {leagueName}. Ask
        them to add you to the team.
      </Notice>
    );
  }
  if (result?.status === "closed") {
    return <Notice title="Registrations just closed">Sorry, {leagueName} closed before your form went through.</Notice>;
  }

  return (
    <form onSubmit={(e) => (isLast ? onSubmit(e) : (e.preventDefault(), next()))} noValidate>
      <ol className="mb-6 grid grid-cols-2 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("mt-1.5 block text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <FieldGroup className="gap-5">
          {!notListed ? (
            <Field data-invalid={!!errors.college?.collegeId}>
              <FieldLabel htmlFor="college-search">College</FieldLabel>
              {/* Registered so react-hook-form keeps this field's "Pick your college" error (it's set via setValue). */}
              <input type="hidden" {...register("college.collegeId")} />
              <CollegeSearch
                autoFocus
                selectedId={watch("college.collegeId")}
                selectedLabel={watch("college.collegeLabel")}
                invalid={!!errors.college?.collegeId}
                onSelect={(c) => {
                  setValue("college.collegeId", c.id, { shouldValidate: true });
                  setValue("college.collegeLabel", c.name);
                }}
                onQueryChange={(q) => {
                  if (watch("college.collegeId")) {
                    setValue("college.collegeId", null);
                    setValue("college.collegeLabel", "");
                  }
                  setValue("college.newCollege.name", q);
                }}
              />
              <FieldError errors={[errors.college?.collegeId]} />
              <Button
                type="button"
                variant="link"
                className="h-auto self-start p-0"
                onClick={() => {
                  setValue("college.notListed", true);
                  setValue("college.collegeId", null);
                  setValue("college.collegeLabel", "");
                }}
              >
                Not listed? Add it
              </Button>
            </Field>
          ) : (
            <>
              <Field data-invalid={!!errors.college?.newCollege?.name}>
                <FieldLabel htmlFor="college-name">College name</FieldLabel>
                <Input id="college-name" autoFocus className={input} placeholder="Full name" {...register("college.newCollege.name")} />
                <FieldError errors={[errors.college?.newCollege?.name]} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.college?.newCollege?.city}>
                  <FieldLabel htmlFor="college-city">City</FieldLabel>
                  <Input id="college-city" className={input} autoComplete="address-level2" {...register("college.newCollege.city")} />
                  <FieldError errors={[errors.college?.newCollege?.city]} />
                </Field>
                <Field data-invalid={!!errors.college?.newCollege?.state}>
                  <FieldLabel htmlFor="college-state">State</FieldLabel>
                  <Controller
                    control={control}
                    name="college.newCollege.state"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger id="college-state" className="h-12! w-full" aria-invalid={!!errors.college?.newCollege?.state}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.college?.newCollege?.state]} />
                </Field>
              </div>
              <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => setValue("college.notListed", false)}>
                Search the list instead
              </Button>
            </>
          )}

          <FieldSeparator>You (team captain)</FieldSeparator>

          <Field data-invalid={!!errors.poc?.name}>
            <FieldLabel htmlFor="poc-name">Your name</FieldLabel>
            <Input id="poc-name" autoComplete="name" className={input} {...register("poc.name")} />
            <FieldError errors={[errors.poc?.name]} />
          </Field>
          <Field data-invalid={!!errors.poc?.email}>
            <FieldLabel htmlFor="poc-email">Email</FieldLabel>
            <Input id="poc-email" type="email" inputMode="email" autoComplete="email" className={input} {...register("poc.email")} />
            <FieldDescription>Your invite comes here once approved.</FieldDescription>
            <FieldError errors={[errors.poc?.email]} />
          </Field>
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field data-invalid={!!errors.poc?.phone}>
              <FieldLabel htmlFor="poc-phone">WhatsApp</FieldLabel>
              <Input
                id="poc-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                placeholder="10 digits"
                className={input}
                {...register("poc.phone")}
              />
              <FieldError errors={[errors.poc?.phone]} />
            </Field>
            <Field data-invalid={!!errors.poc?.matiksUsername}>
              <FieldLabel htmlFor="poc-username">Matiks username</FieldLabel>
              <Input id="poc-username" autoCapitalize="none" autoCorrect="off" className={input} {...register("poc.matiksUsername")} />
              <FieldError errors={[errors.poc?.matiksUsername]} />
            </Field>
          </div>
          <Field data-invalid={!!errors.poc?.year}>
            <FieldLabel id="poc-year-label">Year</FieldLabel>
            <Controller
              control={control}
              name="poc.year"
              render={({ field }) => (
                <div role="radiogroup" aria-labelledby="poc-year-label" className="flex flex-wrap gap-2">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      role="radio"
                      aria-checked={field.value === y}
                      aria-label={y}
                      onClick={() => field.onChange(y)}
                      onBlur={field.onBlur}
                      className={cn(
                        "h-11 min-w-12 rounded-lg border px-3 text-sm font-semibold transition-colors",
                        field.value === y ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                      )}
                    >
                      {YEAR_LABELS[y]}
                    </button>
                  ))}
                </div>
              )}
            />
            <FieldError errors={[errors.poc?.year]} />
          </Field>
        </FieldGroup>
      )}

      {step === 1 && (
        <FieldGroup className="gap-5">
          <Collapsible defaultOpen={teammates.fields.length > 0} className="rounded-2xl border bg-card">
            <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold">
              <span>
                Add teammates <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t px-4 py-4">
              <Field data-invalid={!!errors.team?.teamName}>
                <FieldLabel htmlFor="team-name">Team name</FieldLabel>
                <Input id="team-name" className={input} {...register("team.teamName")} />
                <FieldError errors={[errors.team?.teamName]} />
              </Field>
              {teammates.fields.map((row, i) => {
                const rowErrors = errors.team?.teammates?.[i];
                return (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                    <Field data-invalid={!!rowErrors?.name}>
                      <FieldLabel htmlFor={`tm-${i}-name`} className="sr-only">
                        Teammate {i + 1} name
                      </FieldLabel>
                      <Input id={`tm-${i}-name`} placeholder="Name" className={input} {...register(`team.teammates.${i}.name`)} />
                      <FieldError errors={[rowErrors?.name]} />
                    </Field>
                    <Field data-invalid={!!rowErrors?.matiksUsername}>
                      <FieldLabel htmlFor={`tm-${i}-username`} className="sr-only">
                        Teammate {i + 1} Matiks username
                      </FieldLabel>
                      <Input
                        id={`tm-${i}-username`}
                        placeholder="Matiks username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className={input}
                        {...register(`team.teammates.${i}.matiksUsername`)}
                      />
                      <FieldError errors={[rowErrors?.matiksUsername]} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" className="size-12" onClick={() => teammates.remove(i)} aria-label={`Remove teammate ${i + 1}`}>
                      <Trash2Icon />
                    </Button>
                  </div>
                );
              })}
              <FieldError errors={[errors.team?.teammates?.root, errors.team?.teammates]} />
              {teammates.fields.length < 10 && (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => teammates.append({ name: "", email: "", matiksUsername: "" }, { shouldFocus: true })}>
                  <PlusIcon /> Add teammate
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Field orientation="horizontal" data-invalid={!!errors.review?.consent}>
            <Controller
              control={control}
              name="review.consent"
              render={({ field }) => (
                <Checkbox id="consent" className="size-5" checked={field.value === true} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            <FieldLabel htmlFor="consent" className="leading-snug font-normal">
              I agree to the league rules and let Matiks store these details to run the league.
            </FieldLabel>
          </Field>
          <FieldError errors={[errors.review?.consent]} />

          <Field data-invalid={!!errors.review?.turnstileToken}>
            <Turnstile key={captchaKey} onToken={(token) => setValue("review.turnstileToken", token, { shouldValidate: !!token })} />
            <FieldError errors={[errors.review?.turnstileToken]} />
          </Field>
          {serverError && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </FieldGroup>
      )}

      {/* Sticky on phones so the primary button is always in reach. */}
      <div className="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t border-border/60 bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {step > 0 && (
          <Button type="button" variant="outline" className="h-12 px-4" onClick={() => setStep(0)} disabled={pending} aria-label="Back">
            <ArrowLeftIcon />
          </Button>
        )}
        <Button type="submit" size="lg" className="h-12 flex-1 text-base tracking-wide uppercase" disabled={pending}>
          {isLast ? (
            pending ? (
              <>
                <Loader2Icon className="animate-spin" /> Registering…
              </>
            ) : (
              "Register"
            )
          ) : (
            <>
              Next <ArrowRightIcon />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-3xl border bg-card p-6">
      <h2 className="text-3xl">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
