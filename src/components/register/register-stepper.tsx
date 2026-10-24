"use client";

import { ArrowLeftIcon, ArrowRightIcon, BadgeCheckIcon, CheckIcon, CloudIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { registerMyCollege } from "@/app/college/actions";
import { discardDraft, isEmailVerified, saveDraft } from "@/app/college/register-actions";
import { Glass } from "@/components/glass";
import { LogoUpload } from "@/components/logo-upload";
import { ContactFieldsForm } from "@/components/portal/contact-fields";
import { CardPreview, weekLabel } from "@/components/register/card-preview";
import { LeagueWeek } from "@/components/register/league-week";
import { SquadTarget } from "@/components/register/squad-target";
import { VerifyEmail } from "@/components/register/verify-email";
import { SegmentedControl } from "@/components/segmented-control";
import { Sticker } from "@/components/stickers";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { confetti } from "@/lib/confetti";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import { formatINR, prizeProgress } from "@/lib/league";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  COUNTRY_FLAGS,
  COUNTRY_LABELS,
  pocRegisterSchema,
  type ContactFields,
  type Country,
  type DetailsFormValues,
  type PocRegisterInput,
  type RegisterDraft,
} from "@/lib/validation/portal";

export type StepperState = {
  step: number;
  college: CollegeSearchResult | null;
  newName: string | null;
  country: Country;
  details: DetailsFormValues;
  contact: ContactFields;
  targetPlayers: number;
  customDates: boolean;
};

const STEPS = [
  { key: "college", label: "College", title: "Your college" },
  { key: "email", label: "College email", title: "Your college email" },
  { key: "verify", label: "Verify", title: "Get the Verified badge" },
  { key: "logos", label: "Logos", title: "Show your colours" },
  { key: "week", label: "League week", title: "Pick your league week" },
  { key: "you", label: "Your details", title: "About you" },
  { key: "squad", label: "Squad target", title: "How many players can you bring?" },
  { key: "review", label: "Review", title: "Ready to claim it?" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

/** Which form fields each step owns (zod issue paths). */
const FIELDS: Record<StepKey, string[]> = {
  college: ["collegeName"],
  email: ["details.collegeEmail", "details.emailDomain"],
  verify: [],
  logos: ["details.collegeLogoUrl", "details.clubLogoUrl", "details.clubName"],
  week: ["details.registrationStart", "details.leagueStart", "details.leagueEnd"],
  you: ["contact."],
  squad: ["targetPlayers"],
  review: [""],
};

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }));
const domainOf = (email: string) => (email.includes("@") ? email.split("@").pop()!.trim().toLowerCase() : "");

export function toDraft(s: StepperState): RegisterDraft {
  return {
    step: s.step,
    college: s.college ? { id: s.college.id, name: s.college.name, country: s.college.country, city: s.college.city, state: s.college.state } : null,
    newName: s.newName,
    country: s.country,
    details: s.details,
    contact: s.contact as unknown as Record<string, string | null>,
    targetPlayers: s.targetPlayers,
    customDates: s.customDates,
  };
}

type Buddy = { kind: "nod" | "cheer" | "bounce"; n: number } | null;

/**
 * One question per screen: College → College email → Verify (optional) → Logos → League week → Your details →
 * Squad target → Review. Enter continues, swipe on phones, autosaves a server-side draft, and the college card
 * builds beside it. A trophy sticker reacts (the mascot is for public pages only, CLAUDE.md rule 8).
 */
export function RegisterStepper({
  initial,
  userId,
  season,
  today,
  verifyEnabled,
  onChangeCollege,
}: {
  initial: StepperState;
  userId: string;
  season: string;
  today: string;
  verifyEnabled: boolean;
  onChangeCollege: () => void;
}) {
  const router = useRouter();
  const [s, setS] = useState<StepperState>(initial);
  const [dir, setDir] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Verified state for the current college email: checked when the Verify step opens (resumed drafts included).
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [buddy, setBuddy] = useState<Buddy>(null);
  const [submitting, startSubmit] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const submitted = useRef(false);

  const step = STEPS[s.step];
  const country = s.college?.country ?? s.country;
  const collegeName = s.college?.name ?? s.newName ?? "";
  const email = s.details.collegeEmail.trim().toLowerCase();
  const isVerified = !!email && verifiedEmail === email;
  const input: PocRegisterInput = useMemo(
    () => ({ collegeId: s.college?.id ?? null, collegeName, country, details: s.details, contact: s.contact, targetPlayers: s.targetPlayers }),
    [s, collegeName, country],
  );

  // Autosave: ~1 s after the last change (and right after claiming), to the user's one server-side draft.
  useEffect(() => {
    if (submitted.current) return;
    const t = setTimeout(async () => {
      if (submitted.current) return;
      setSave("saving");
      const res = await saveDraft(toDraft(s));
      setSave(res.ok ? "saved" : "error");
    }, 900);
    return () => clearTimeout(t);
  }, [s]);

  useEffect(() => {
    if (step.key !== "verify" || !email || email === verifiedEmail) return;
    let live = true;
    void isEmailVerified(email).then((ok) => live && ok && setVerifiedEmail(email));
    return () => {
      live = false;
    };
  }, [step.key, email, verifiedEmail]);

  // Each new step: focus its question (screen readers hear it; keyboard users start there).
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [s.step]);

  const react = (kind: NonNullable<Buddy>["kind"]) => setBuddy((b) => ({ kind, n: (b?.n ?? 0) + 1 }));
  const update = (patch: Partial<StepperState>) => setS((prev) => ({ ...prev, ...patch }));
  const setDetails = (patch: Partial<DetailsFormValues>) => setS((prev) => ({ ...prev, details: { ...prev.details, ...patch } }));

  function stepErrors(key: StepKey) {
    const parsed = pocRegisterSchema.safeParse(input);
    if (parsed.success) return {};
    const owned = FIELDS[key];
    const out: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (owned.some((f) => (f.endsWith(".") ? path.startsWith(f) : f === "" || path === f))) out[path] ??= issue.message;
    }
    return out;
  }

  function go(to: number) {
    setDir(to > s.step ? 1 : -1);
    setErrors({});
    update({ step: Math.max(0, Math.min(STEPS.length - 1, to)) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    if (step.key === "review") return submit();
    const errs = stepErrors(step.key);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    react("nod");
    go(s.step + 1);
  }

  function submit() {
    const errs = stepErrors("review");
    if (Object.keys(errs).length) {
      const firstKey = Object.keys(errs)[0];
      const owner = STEPS.findIndex((st) => FIELDS[st.key].some((f) => f && (f.endsWith(".") ? firstKey.startsWith(f) : f === firstKey)));
      if (owner >= 0) go(owner);
      setTimeout(() => setErrors(errs), 0);
      toast.error("Fix the highlighted fields");
      return;
    }
    react("bounce");
    submitted.current = true; // no autosave can land after the server deletes the draft
    startSubmit(async () => {
      const res = await registerMyCollege(input);
      if (!res.ok) {
        submitted.current = false;
        toast.error(res.error);
        return;
      }
      confetti();
      router.replace("/college?registered=1");
    });
  }

  async function discard() {
    if (!window.confirm("Discard this draft and start over?")) return;
    await discardDraft();
    onChangeCollege();
    router.refresh();
  }

  const pct = Math.round(((s.step + 1) / STEPS.length) * 100);
  const err = (k: string) => errors[k];

  return (
    <div className="space-y-4">
      <Glass className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
          <span>
            Building your arena… <span className="font-mono text-primary">{pct}%</span>
          </span>
          <span className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span aria-live="polite" className="flex items-center gap-1.5">
              {save === "saving" ? <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> : save === "error" ? null : <CloudIcon className="size-3.5" aria-hidden />}
              {save === "saving" ? "Saving…" : save === "error" ? "Not saved" : save === "saved" ? "Saved" : "Autosaves"}
            </span>
            <button type="button" onClick={discard} className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/8 hover:text-foreground">
              <Trash2Icon className="size-3.5" aria-hidden /> Discard draft
            </button>
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-white/8"
          role="progressbar"
          aria-label="Registration progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#e8ff9c] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-2.5 flex gap-1.5" aria-label="Steps">
          {STEPS.map((st, i) => (
            <li key={st.key} className="flex-1">
              <button
                type="button"
                onClick={() => i < s.step && go(i)}
                disabled={i >= s.step}
                aria-label={`${st.label}${i < s.step ? " (done, edit)" : i === s.step ? " (current)" : ""}`}
                aria-current={i === s.step ? "step" : undefined}
                className={cn("block h-1.5 w-full rounded-full", i <= s.step ? "bg-primary" : "bg-white/10", i < s.step && "cursor-pointer hover:opacity-75")}
              />
            </li>
          ))}
        </ol>
      </Glass>

      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Glass className="relative min-w-0 p-5 sm:p-7">
          <Sticker
            name="trophy"
            eager
            key={buddy ? `${buddy.kind}-${buddy.n}` : "idle"}
            className={cn("absolute -top-7 right-3 h-auto w-20 sm:-right-4 sm:w-24", buddy && `buddy-${buddy.kind}`)}
            style={{ "--tilt": "10deg" } as React.CSSProperties}
          />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            onTouchStart={(e) => {
              if ((e.target as HTMLElement).closest("input[type=range]")) return;
              touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              const t = touch.current;
              touch.current = null;
              if (!t) return;
              const dx = e.changedTouches[0].clientX - t.x;
              const dy = e.changedTouches[0].clientY - t.y;
              if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
              if (dx < 0) next();
              else if (s.step > 0) go(s.step - 1);
            }}
          >
            <div key={s.step} className="step-in space-y-5" style={{ "--step-from": `${dir * 18}px` } as React.CSSProperties}>
              <div className="pr-16 sm:pr-20">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Step {s.step + 1} of {STEPS.length} · {step.label}
                </p>
                <h2 ref={heading} tabIndex={-1} className="mt-1 text-4xl outline-none sm:text-5xl">
                  {step.title}
                </h2>
              </div>

              {step.key === "college" && (
                <div className="space-y-4">
                  {s.college ? (
                    <div className="glass-surface flex items-center gap-3 rounded-2xl p-4">
                      <CheckIcon className="size-5 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{s.college.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {[s.college.city, s.college.state].filter(Boolean).join(", ") || COUNTRY_LABELS[s.college.country]} · unclaimed
                        </span>
                      </span>
                      <Button type="button" variant="ghost" className="h-10 rounded-full" onClick={onChangeCollege}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Field data-invalid={!!err("collegeName")}>
                        <FieldLabel htmlFor="new-college">College name</FieldLabel>
                        <Input
                          id="new-college"
                          value={s.newName ?? ""}
                          onChange={(e) => update({ newName: e.target.value })}
                          placeholder="Full name, e.g. Indian Institute of Technology Guwahati"
                          className="h-12"
                          aria-invalid={!!err("collegeName") || undefined}
                        />
                        <FieldDescription>A new college. We&apos;ll add it to the list once you submit.</FieldDescription>
                        <FieldError>{err("collegeName")}</FieldError>
                      </Field>
                      <Field>
                        <FieldLabel>Country</FieldLabel>
                        <SegmentedControl label="Country" className="self-start" options={COUNTRY_OPTIONS} value={s.country} onChange={(c) => update({ country: c })} />
                      </Field>
                      <button type="button" onClick={onChangeCollege} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                        Search the list again
                      </button>
                    </>
                  )}
                </div>
              )}

              {step.key === "email" && (
                <div className="space-y-4">
                  <Field data-invalid={!!err("details.collegeEmail")}>
                    <FieldLabel htmlFor="reg-collegeEmail">College email ID</FieldLabel>
                    <Input
                      id="reg-collegeEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="sports@iitg.ac.in"
                      value={s.details.collegeEmail}
                      onChange={(e) => {
                        const v = e.target.value;
                        const auto = !s.details.emailDomain || s.details.emailDomain === domainOf(s.details.collegeEmail);
                        setDetails({ collegeEmail: v, ...(auto && { emailDomain: domainOf(v) }) });
                      }}
                      className="h-12"
                      aria-invalid={!!err("details.collegeEmail") || undefined}
                    />
                    <FieldDescription>An official address of the college, club or sports office.</FieldDescription>
                    <FieldError>{err("details.collegeEmail")}</FieldError>
                  </Field>
                  <Field data-invalid={!!err("details.emailDomain")}>
                    <FieldLabel htmlFor="reg-emailDomain">College email domain</FieldLabel>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-muted-foreground" aria-hidden>
                        @
                      </span>
                      <Input
                        id="reg-emailDomain"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="iitg.ac.in"
                        value={s.details.emailDomain}
                        onChange={(e) => setDetails({ emailDomain: e.target.value.replace(/^@+/, "").toLowerCase() })}
                        className="h-12 pl-8"
                        aria-invalid={!!err("details.emailDomain") || undefined}
                      />
                    </div>
                    <FieldDescription>Filled from the email; change it if students use another domain.</FieldDescription>
                    <FieldError>{err("details.emailDomain")}</FieldError>
                  </Field>
                </div>
              )}

              {step.key === "verify" && (
                <VerifyEmail
                  email={s.details.collegeEmail.trim().toLowerCase()}
                  enabled={verifyEnabled}
                  verified={isVerified}
                  onVerified={() => {
                    setVerifiedEmail(email);
                    react("cheer");
                  }}
                />
              )}

              {step.key === "logos" && (
                <div className="space-y-4">
                  <LogoUpload
                    folder={`users/${userId}`}
                    name="college"
                    label="College logo"
                    camera
                    value={s.details.collegeLogoUrl}
                    onChange={(url) => {
                      setDetails({ collegeLogoUrl: url });
                      if (url) react("cheer");
                    }}
                    invalid={!!err("details.collegeLogoUrl")}
                  />
                  <div className="space-y-2">
                    <LogoUpload
                      folder={`users/${userId}`}
                      name="club"
                      label="Club logo (Hosted by)"
                      camera
                      value={s.details.clubLogoUrl}
                      onChange={(url) => {
                        setDetails({ clubLogoUrl: url });
                        if (url) react("cheer");
                      }}
                      invalid={!!err("details.clubLogoUrl")}
                    />
                    <Field data-invalid={!!err("details.clubName")}>
                      <FieldLabel htmlFor="reg-clubName">Club name</FieldLabel>
                      <Input id="reg-clubName" placeholder="e.g. Coding Club" autoComplete="off" value={s.details.clubName} onChange={(e) => setDetails({ clubName: e.target.value })} className="h-12" />
                      <FieldError>{err("details.clubName")}</FieldError>
                    </Field>
                  </div>
                  <p className="text-xs text-muted-foreground">Optional, but your card looks much better with them. Add them later if you need to.</p>
                </div>
              )}

              {step.key === "week" && (
                <LeagueWeek
                  today={today}
                  registrationStart={s.details.registrationStart}
                  leagueStart={s.details.leagueStart}
                  leagueEnd={s.details.leagueEnd}
                  custom={s.customDates}
                  onChange={(v) => setS((prev) => ({ ...prev, customDates: v.custom, details: { ...prev.details, registrationStart: v.registrationStart, leagueStart: v.leagueStart, leagueEnd: v.leagueEnd } }))}
                  errors={{ registrationStart: err("details.registrationStart"), leagueStart: err("details.leagueStart"), leagueEnd: err("details.leagueEnd") }}
                />
              )}

              {step.key === "you" && (
                <div className="space-y-3">
                  <ContactFieldsForm
                    idPrefix="me"
                    value={s.contact}
                    onChange={(c) => update({ contact: c })}
                    errors={Object.fromEntries(Object.entries(errors).flatMap(([k, v]) => (k.startsWith("contact.") ? [[k.slice(8), v]] : [])))}
                  />
                  <p className="text-xs text-muted-foreground">T-shirt, address and pincode can wait; we ask again before shipping merch.</p>
                </div>
              )}

              {step.key === "squad" && (
                <div className="space-y-2">
                  <p className="text-foreground/85">A target, not a promise. Matiks admins see it.</p>
                  <label htmlFor="squad-target" className="sr-only">
                    Players you can bring
                  </label>
                  <SquadTarget id="squad-target" value={s.targetPlayers} onChange={(v) => update({ targetPlayers: v })} country={country} />
                </div>
              )}

              {step.key === "review" && (
                <dl className="divide-y divide-white/8 rounded-2xl bg-white/4">
                  {(
                    [
                      [0, "College", `${collegeName}${s.college ? "" : " (new)"} · ${COUNTRY_LABELS[country]}`],
                      [1, "College email", <>{s.details.collegeEmail} {isVerified && <BadgeCheckIcon className="inline size-4 text-status-live-fg" aria-label="Verified" />}</>],
                      [3, "Logos", [s.details.collegeLogoUrl && "College", s.details.clubLogoUrl && "Club"].filter(Boolean).join(" + ") || "None yet"],
                      [3, "Hosted by", s.details.clubName || "—"],
                      [4, "League week", weekLabel(s.details.leagueStart, s.details.leagueEnd) ?? "—"],
                      [5, "You", `${s.contact.name} · ${s.contact.phone}`],
                      [6, "Squad target", country === "usa" ? `${s.targetPlayers} players` : `${s.targetPlayers} players · ${formatINR(prizeProgress(s.targetPlayers).unlocked)}`],
                    ] as const
                  ).map(([to, label, value]) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3">
                      <dt className="w-28 shrink-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
                      <dd className="min-w-0 flex-1 truncate text-sm">{value}</dd>
                      <button type="button" onClick={() => go(to)} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/8" aria-label={`Edit ${label}`}>
                        <PencilIcon className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              {s.step > 0 ? (
                <Button type="button" variant="outline" className="h-12 rounded-full px-5" onClick={() => go(s.step - 1)}>
                  <ArrowLeftIcon /> Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" className="h-12 rounded-full px-7" disabled={submitting}>
                {submitting && <Loader2Icon className="animate-spin" />}
                {step.key === "review" ? "Submit for review" : step.key === "verify" && !isVerified ? "Skip for now" : "Next"}
                {step.key !== "review" && <ArrowRightIcon />}
              </Button>
            </div>
          </form>
        </Glass>

        <div className="min-w-0 lg:sticky lg:top-24">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Live preview · the card you&apos;ll share</p>
          <CardPreview
            name={collegeName}
            place={[s.college?.city, s.college?.state].filter(Boolean).join(", ") || null}
            season={season}
            country={country}
            collegeLogoUrl={s.details.collegeLogoUrl}
            clubName={s.details.clubName}
            clubLogoUrl={s.details.clubLogoUrl}
            week={weekLabel(s.details.leagueStart, s.details.leagueEnd)}
            players={s.targetPlayers}
          />
        </div>
      </div>
    </div>
  );
}
