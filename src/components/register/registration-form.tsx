"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { submitRegistration } from "@/app/(public)/register/actions";
import { CollegeSearch } from "@/components/register/college-search";
import { Turnstile } from "@/components/register/turnstile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/indian-states";
import {
  COLLEGE_TYPES,
  COLLEGE_TYPE_LABELS,
  YEARS,
  registrationSchema,
  type RegistrationData,
  type RegistrationInput,
  type RegistrationResult,
} from "@/lib/validation/registration";

const STEPS = [
  { title: "College", fields: ["college"] },
  { title: "Your details", fields: ["poc"] },
  { title: "Team", fields: ["team"] },
  { title: "Review", fields: ["review"] },
] as const satisfies { title: string; fields: FieldPath<RegistrationInput>[] }[];

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

export function RegistrationForm({ leagueName }: { leagueName: string }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationResult | null>(null);
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
    const valid = await trigger(STEPS[step].fields);
    if (!valid) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const res = await submitRegistration(data);
      // Success redirects to /register/success, so we only get here on a non-success result.
      // Turnstile tokens are single-use: reset the widget for a retry.
      setValue("review.turnstileToken", "");
      setCaptchaKey((k) => k + 1);
      if (res.status === "error") toast.error(res.message);
      else setResult(res);
    });
  });

  if (result?.status === "already_registered") {
    return (
      <div className="space-y-4 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">{result.collegeName} is already registered</h2>
        <p className="text-sm text-muted-foreground">
          {result.pocFirstName ? `${result.pocFirstName} has` : "Someone has"} already registered your
          college for {leagueName}. Get in touch with them to join the team.
          {/* TODO: add the Matiks support contact (email/WhatsApp) for students who can't reach their POC. */}
        </p>
        <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  if (result?.status === "closed") {
    return (
      <div className="space-y-2 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Registrations just closed</h2>
        <p className="text-sm text-muted-foreground">
          Sorry, registrations for {leagueName} closed before your form went through.
        </p>
      </div>
    );
  }

  const values = watch();

  return (
    <form onSubmit={(e) => (isLast ? onSubmit(e) : (e.preventDefault(), next()))} noValidate>
      {/* Progress */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="font-medium text-foreground">{STEPS[step].title}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <FieldGroup>
          {!notListed ? (
            <Field data-invalid={!!errors.college?.collegeId}>
              <FieldLabel htmlFor="college-search">Your college</FieldLabel>
              <CollegeSearch
                selectedId={values.college.collegeId}
                selectedLabel={values.college.collegeLabel ?? ""}
                invalid={!!errors.college?.collegeId}
                onSelect={(c) => {
                  setValue("college.collegeId", c.id, { shouldValidate: true });
                  setValue("college.collegeLabel", c.name);
                }}
                onQueryChange={(q) => {
                  if (values.college.collegeId) {
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
                My college isn&apos;t listed
              </Button>
            </Field>
          ) : (
            <>
              <Field data-invalid={!!errors.college?.newCollege?.name}>
                <FieldLabel htmlFor="college-name">College name</FieldLabel>
                <Input
                  id="college-name"
                  className="h-11 text-base"
                  placeholder="Full name, e.g. Indian Institute of Technology Bombay"
                  {...register("college.newCollege.name")}
                />
                <FieldError errors={[errors.college?.newCollege?.name]} />
              </Field>
              <Field data-invalid={!!errors.college?.newCollege?.city}>
                <FieldLabel htmlFor="college-city">City</FieldLabel>
                <Input id="college-city" className="h-11 text-base" {...register("college.newCollege.city")} />
                <FieldError errors={[errors.college?.newCollege?.city]} />
              </Field>
              <Field data-invalid={!!errors.college?.newCollege?.state}>
                <FieldLabel htmlFor="college-state">State</FieldLabel>
                <Controller
                  control={control}
                  name="college.newCollege.state"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="college-state" className="h-11 w-full">
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
                  )}
                />
                <FieldError errors={[errors.college?.newCollege?.state]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="college-type">College type</FieldLabel>
                <Controller
                  control={control}
                  name="college.newCollege.type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="college-type" className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLLEGE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {COLLEGE_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Button
                type="button"
                variant="link"
                className="h-auto self-start p-0"
                onClick={() => setValue("college.notListed", false)}
              >
                Search the list instead
              </Button>
            </>
          )}
        </FieldGroup>
      )}

      {step === 1 && (
        <FieldGroup>
          <FieldDescription>
            You&apos;re the point of contact (POC) for your college. We&apos;ll use these details to
            reach you about the league.
          </FieldDescription>
          <Field data-invalid={!!errors.poc?.name}>
            <FieldLabel htmlFor="poc-name">Full name</FieldLabel>
            <Input id="poc-name" autoComplete="name" className="h-11 text-base" {...register("poc.name")} />
            <FieldError errors={[errors.poc?.name]} />
          </Field>
          <Field data-invalid={!!errors.poc?.email}>
            <FieldLabel htmlFor="poc-email">College email</FieldLabel>
            <Input
              id="poc-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="h-11 text-base"
              {...register("poc.email")}
            />
            <FieldDescription>You&apos;ll use this to log in and manage your registration.</FieldDescription>
            <FieldError errors={[errors.poc?.email]} />
          </Field>
          <Field data-invalid={!!errors.poc?.phone}>
            <FieldLabel htmlFor="poc-phone">WhatsApp number</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">+91</span>
              <Input
                id="poc-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                className="h-11 text-base"
                {...register("poc.phone")}
              />
            </div>
            <FieldError errors={[errors.poc?.phone]} />
          </Field>
          <Field data-invalid={!!errors.poc?.year}>
            <FieldLabel htmlFor="poc-year">Year</FieldLabel>
            <Controller
              control={control}
              name="poc.year"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="poc-year" className="h-11 w-full">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.poc?.year]} />
          </Field>
          <Field data-invalid={!!errors.poc?.course}>
            <FieldLabel htmlFor="poc-course">Course</FieldLabel>
            <Input id="poc-course" placeholder="e.g. B.Tech CSE" className="h-11 text-base" {...register("poc.course")} />
            <FieldError errors={[errors.poc?.course]} />
          </Field>
          <Field data-invalid={!!errors.poc?.matiksUsername}>
            <FieldLabel htmlFor="poc-username">Matiks username</FieldLabel>
            <Input
              id="poc-username"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-11 text-base"
              {...register("poc.matiksUsername")}
            />
            {/* TODO: link to the Matiks app download page for students without an account. */}
            <FieldDescription>Your username in the Matiks app.</FieldDescription>
            <FieldError errors={[errors.poc?.matiksUsername]} />
          </Field>
        </FieldGroup>
      )}

      {step === 2 && (
        <FieldGroup>
          <FieldDescription>
            Optional. You can add or change teammates later from &ldquo;My registration&rdquo;.
          </FieldDescription>
          <Field data-invalid={!!errors.team?.teamName}>
            <FieldLabel htmlFor="team-name">Team name</FieldLabel>
            <Input id="team-name" className="h-11 text-base" {...register("team.teamName")} />
            <FieldError errors={[errors.team?.teamName]} />
          </Field>

          {teammates.fields.map((row, i) => {
            const rowErrors = errors.team?.teammates?.[i];
            return (
              <div key={row.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Teammate {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => teammates.remove(i)}
                    aria-label={`Remove teammate ${i + 1}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <Field data-invalid={!!rowErrors?.name}>
                  <FieldLabel htmlFor={`tm-${i}-name`}>Name</FieldLabel>
                  <Input id={`tm-${i}-name`} className="h-11 text-base" {...register(`team.teammates.${i}.name`)} />
                  <FieldError errors={[rowErrors?.name]} />
                </Field>
                <Field data-invalid={!!rowErrors?.email}>
                  <FieldLabel htmlFor={`tm-${i}-email`}>Email (optional)</FieldLabel>
                  <Input
                    id={`tm-${i}-email`}
                    type="email"
                    inputMode="email"
                    className="h-11 text-base"
                    {...register(`team.teammates.${i}.email`)}
                  />
                  <FieldError errors={[rowErrors?.email]} />
                </Field>
                <Field data-invalid={!!rowErrors?.matiksUsername}>
                  <FieldLabel htmlFor={`tm-${i}-username`}>Matiks username</FieldLabel>
                  <Input
                    id={`tm-${i}-username`}
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="h-11 text-base"
                    {...register(`team.teammates.${i}.matiksUsername`)}
                  />
                  <FieldError errors={[rowErrors?.matiksUsername]} />
                </Field>
              </div>
            );
          })}
          <FieldError errors={[errors.team?.teammates?.root, errors.team?.teammates]} />

          {teammates.fields.length < 10 && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => teammates.append({ name: "", email: "", matiksUsername: "" })}
            >
              <PlusIcon /> Add teammate
            </Button>
          )}
        </FieldGroup>
      )}

      {step === 3 && (
        <FieldGroup>
          <dl className="divide-y rounded-lg border text-sm">
            <ReviewRow
              label="College"
              value={
                values.college.notListed
                  ? `${values.college.newCollege.name} (${values.college.newCollege.city}, ${values.college.newCollege.state})`
                  : values.college.collegeLabel
              }
              onEdit={() => setStep(0)}
            />
            <ReviewRow
              label="You"
              value={`${values.poc.name} · ${values.poc.email} · ${values.poc.phone} · @${values.poc.matiksUsername}`}
              onEdit={() => setStep(1)}
            />
            <ReviewRow
              label="Team"
              value={
                [
                  values.team.teamName || "No team name yet",
                  values.team.teammates.length
                    ? values.team.teammates.map((t) => t.name).join(", ")
                    : "No teammates yet",
                ].join(" · ")
              }
              onEdit={() => setStep(2)}
            />
          </dl>

          <Field orientation="horizontal" data-invalid={!!errors.review?.consent}>
            <Controller
              control={control}
              name="review.consent"
              render={({ field }) => (
                <Checkbox
                  id="consent"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <FieldLabel htmlFor="consent" className="font-normal leading-snug">
              {/* TODO: link to the league rules and the Matiks privacy policy. */}
              I agree to the league rules and allow Matiks to store these details to run the league and
              contact me about it.
            </FieldLabel>
          </Field>
          <FieldError errors={[errors.review?.consent]} />

          <Field data-invalid={!!errors.review?.turnstileToken}>
            <Turnstile
              key={captchaKey}
              onToken={(token) => setValue("review.turnstileToken", token, { shouldValidate: !!token })}
            />
            <FieldError errors={[errors.review?.turnstileToken]} />
          </Field>
        </FieldGroup>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={back} disabled={pending}>
            <ArrowLeftIcon /> Back
          </Button>
        )}
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {isLast ? (
            pending ? (
              <>
                <Loader2Icon className="animate-spin" /> Submitting…
              </>
            ) : (
              "Submit registration"
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

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{value}</dd>
      </div>
      <Button type="button" variant="link" size="sm" className="h-auto shrink-0 p-0" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}
