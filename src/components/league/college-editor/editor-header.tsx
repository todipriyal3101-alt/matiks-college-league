"use client";

import {
  BadgeCheckIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CheckIcon,
  GitMergeIcon,
  MailPlusIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { DenyDialog } from "@/components/admin/colleges/deny-dialog";
import { InvitePocDialog } from "@/components/admin/overview/invite-poc-dialog";
import { CollegeShareItems, DeleteRegistrationDialog } from "@/components/admin/overview/row-actions";
import { DetailsFields, SectionLabel } from "@/components/details-fields";
import { ReviewBadge, StageBadge } from "@/components/league/badges";
import { CollegeLogo } from "@/components/league/college-logo";
import { Money } from "@/components/league/money";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay } from "@/lib/ist";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_LABELS, type Country, type DetailsFormValues } from "@/lib/validation/portal";
import type { RegistrationDetail } from "@/lib/data/league-ops";
import {
  effectivePrizePool,
  REVIEW_LABELS,
  REVIEW_STATUSES,
  STAGE_LABELS,
  STAGES,
  type ReviewStatus,
  type Stage,
} from "@/lib/league";

import type { EditorFormValues } from "./form-values";
import { MergeDialog } from "./merge-dialog";

/**
 * Always visible above the tabs: who this is, its status, and the most-used actions
 * (Approve + invite, review, stage, Mark paid). Sticky under the page header.
 */
export function EditorTopBar({
  detail,
  mode,
  readOnly,
  reviewStatus,
  stage,
  stageOverride,
  autoStage,
  unpaid,
  onReviewStatus,
  onDeny,
  onStage,
  onMarkPaid,
}: {
  detail: RegistrationDetail;
  mode: "admin" | "poc";
  readOnly: boolean;
  reviewStatus: ReviewStatus;
  /** What's shown: the override if set, else the automatic stage. */
  stage: Stage;
  stageOverride: Stage | null;
  /** The stage the dates and payouts give (what "Auto" means). */
  autoStage: Stage;
  /** Saved winners not yet paid (admin "Mark paid" menu). */
  unpaid: { id: string; label: string }[];
  onReviewStatus: (status: ReviewStatus) => void;
  /** Resolves to an error message, or null when done. */
  onDeny: (reason: string) => Promise<string | null>;
  onStage: (stage: Stage | null) => void;
  onMarkPaid: (winnerId: string) => void;
}) {
  const { registration } = detail;
  const canAdminWrite = mode === "admin" && !readOnly;
  // A POC without a login yet (admin-added or older registrations) gets the invite dialog when approving.
  const [invite, setInvite] = useState<"invite" | "approve" | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const approve = () => (detail.derived.hasPocAccess ? onReviewStatus("approved") : setInvite("approve"));

  return (
    <div className="glass-strong sticky top-[5.25rem] z-20 rounded-3xl px-4 py-3 sm:top-[5.5rem] sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CollegeLogo url={registration.college_logo_url ?? registration.colleges.logo_url} name={registration.colleges.name} className="size-12" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {registration.leagues.name}
              {registration.colleges.city && ` · ${registration.colleges.city}`}
              {registration.club_name && ` · Hosted by ${registration.club_name}`}
            </p>
            <h1 className="truncate text-3xl sm:text-4xl">{registration.colleges.name}</h1>
          </div>
        </div>
        {canAdminWrite && (
          <AdminMenu
            registrationId={registration.id}
            collegeId={registration.colleges.id}
            collegeName={registration.colleges.name}
            onInvite={() => setInvite("invite")}
            inviteOpen={invite !== null}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canAdminWrite ? (
          <>
            {reviewStatus !== "approved" && (
              <Button type="button" size="sm" className="h-9" onClick={approve}>
                <CheckIcon /> {detail.derived.hasPocAccess ? "Approve" : "Approve + invite"}
              </Button>
            )}
            <Select
              value={reviewStatus}
              onValueChange={(v) => (v === "approved" ? approve() : v === "rejected" ? setDenyOpen(true) : onReviewStatus(v as ReviewStatus))}
            >
              <SelectTrigger id="review-status" size="sm" aria-label="Review" className="w-auto gap-1.5 data-[size=sm]:h-9">
                <ReviewBadge status={reviewStatus} />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {REVIEW_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stageOverride ?? "auto"} onValueChange={(v) => onStage(v === "auto" ? null : (v as Stage))}>
              <SelectTrigger id="stage" size="sm" aria-label="Stage" className="w-auto gap-1.5 data-[size=sm]:h-9">
                <StageBadge stage={stage} />
                <span className="text-xs text-muted-foreground">{stageOverride ? "override" : "auto"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto · {STAGE_LABELS[autoStage]} (from the dates)</SelectItem>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    Override: {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unpaid.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-9">
                    <BanknoteIcon /> Mark paid <span className="font-mono text-muted-foreground">{unpaid.length}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Unpaid winners</DropdownMenuLabel>
                  {unpaid.map((w) => (
                    <DropdownMenuItem key={w.id} onSelect={() => onMarkPaid(w.id)}>
                      {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : (
          <>
            {mode === "admin" && <ReviewBadge status={reviewStatus} />}
            <StageBadge stage={stage} />
          </>
        )}
        {mode === "admin" && detail.derived.domainMismatch && (
          <span
            className="rounded-full bg-status-pending px-2.5 py-0.5 text-xs font-semibold text-status-pending-fg"
            title={`POC signed in as ${registration.poc_email}`}
          >
            Email domain mismatch
          </span>
        )}
        {mode === "admin" && registration.email_verified_at && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-live px-2.5 py-0.5 text-xs font-semibold text-status-live-fg" title={`College email verified (${registration.college_email})`}>
            <BadgeCheckIcon className="size-3.5" aria-hidden /> Verified
          </span>
        )}
        {mode === "admin" && registration.target_players && (
          <span className="rounded-full bg-lilac/15 px-2.5 py-0.5 text-xs font-semibold text-lilac" title="Players the POC aims to bring (registration form)">
            Target {registration.target_players} players
          </span>
        )}
      </div>
      {mode === "admin" && reviewStatus === "rejected" && registration.deny_reason && (
        <p className="mt-2 text-sm text-muted-foreground">
          Denied: <span className="text-foreground">{registration.deny_reason}</span>
        </p>
      )}

      {canAdminWrite && (
        <DenyDialog open={denyOpen} onOpenChange={setDenyOpen} collegeName={registration.colleges.name} onDeny={onDeny} />
      )}
      {canAdminWrite && (
        <InvitePocDialog
          open={invite !== null}
          onOpenChange={(o) => !o && setInvite(null)}
          registrationId={registration.id}
          collegeName={registration.colleges.name}
          pocEmail={registration.poc_email}
          approve={invite === "approve"}
          onApproveOnly={() => {
            setInvite(null);
            onReviewStatus("approved");
          }}
        />
      )}
    </div>
  );
}

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]} ${COUNTRY_LABELS[c]}` }));

/** Overview tab: team name, participants, the prize pool; for admins also the league details and the source. */
export function OverviewPanel({
  mode,
  readOnly,
  participantCount,
  registrationId,
  source,
  locked = false,
  onRequestEdit,
}: {
  mode: "admin" | "poc";
  readOnly: boolean;
  participantCount: number;
  registrationId: string;
  /** Admin default: the POC's details (email, domain, logos, club, dates) are read-only. */
  locked?: boolean;
  /** "Edit as admin" (writers; asks for confirmation first). */
  onRequestEdit?: () => void;
  source: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; referral_code: string | null };
}) {
  const { register, control, formState, setValue } = useFormContext<EditorFormValues>();
  const isAdmin = mode === "admin";
  const [participants, override, details] = useWatch({ control, name: ["participantCount", "prizePoolOverride", "details"] });
  const country: Country = details?.country ?? "india";
  const overrideValue = override === "" || override == null ? null : Number(override);
  const pool = effectivePrizePool(Number(participants) || 0, Number.isFinite(overrideValue) ? overrideValue : null, country);
  const e = formState.errors;
  const detailErrors = Object.fromEntries(
    Object.entries(e.details ?? {}).flatMap(([k, v]) => (v && typeof v === "object" && "message" in v ? [[k, String(v.message)]] : [])),
  );
  const setDetails = (next: DetailsFormValues & { country: Country }) => setValue("details", next, { shouldDirty: true, shouldValidate: formState.isSubmitted });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!e.teamName}>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <Input id="team-name" placeholder="e.g. The Integrators" disabled={readOnly} {...register("teamName")} />
          <FieldError errors={[e.teamName]} />
        </Field>
        <Field data-invalid={!!e.participantCount}>
          <FieldLabel htmlFor="participants">Participants</FieldLabel>
          {isAdmin ? (
            <>
              <Input id="participants" type="number" min={0} inputMode="numeric" className="font-mono" disabled={readOnly} {...register("participantCount")} />
              <FieldError errors={[e.participantCount]} />
            </>
          ) : (
            <p className="pt-1.5 font-mono text-lg">{participantCount}</p>
          )}
        </Field>
        {isAdmin && (
          <Field data-invalid={!!e.prizePoolOverride}>
            <FieldLabel htmlFor="override" className="gap-1">
              {country === "usa" ? "Prize pool ($)" : "Prize override"}
              <Tooltip>
                <TooltipTrigger type="button" className="text-muted-foreground" aria-label="About the override">
                  ⓘ
                </TooltipTrigger>
                <TooltipContent>{country === "usa" ? "USA has no auto tier: set the prize pool in dollars" : "Empty = auto tier from participants"}</TooltipContent>
              </Tooltip>
            </FieldLabel>
            <Input id="override" type="number" min={0} inputMode="numeric" placeholder={country === "usa" ? "0" : "Auto"} className="font-mono" disabled={readOnly} {...register("prizePoolOverride")} />
            <FieldError errors={[e.prizePoolOverride]} />
          </Field>
        )}
      </div>

      <div className="glass-surface flex flex-wrap items-center gap-4 rounded-2xl p-4">
        {pool.auto != null && (
          <>
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Auto tier</div>
              <Money amount={pool.auto} country={country} className="text-lg" />
            </div>
            <ArrowRightIcon className="size-5 text-muted-foreground" />
          </>
        )}
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Prize pool</div>
          <Money amount={pool.amount} country={country} className="font-display text-4xl leading-none text-primary" />
        </div>
        {pool.overridden && country !== "usa" && <span className="rounded-full bg-lilac/15 px-2 py-0.5 text-xs font-semibold text-lilac">Overridden</span>}
      </div>

      {isAdmin && details && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>League details</SectionLabel>
            <SegmentedControl
              label="Country"
              options={COUNTRY_OPTIONS}
              value={country}
              disabled={readOnly}
              onChange={(c) => setDetails({ ...details, country: c })}
            />
          </div>
          {locked ? (
            <DetailsReadOnly details={details} registrationId={registrationId} />
          ) : (
            <DetailsFields
              idPrefix="editor"
              folder={`registrations/${registrationId}`}
              value={details}
              onChange={(d) => setDetails({ ...d, country })}
              errors={detailErrors}
              disabled={readOnly}
            />
          )}
          {locked && !readOnly && onRequestEdit && (
            <button type="button" onClick={onRequestEdit} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              <PencilIcon className="size-3" /> Edit as admin
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-2 pt-2">
          <SectionLabel>Source</SectionLabel>
          <dl className="glass-surface grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl p-4 text-sm sm:grid-cols-5">
            {(
              [
                ["Source", source.utm_source ?? "direct"],
                ["Referral code", source.referral_code],
                ["Medium", source.utm_medium],
                ["Campaign", source.utm_campaign],
                ["Content", source.utm_content],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
                <dd className="truncate font-mono">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function AdminMenu({
  registrationId,
  collegeId,
  collegeName,
  onInvite,
  inviteOpen,
}: {
  registrationId: string;
  collegeId: string;
  collegeName: string;
  onInvite: () => void;
  inviteOpen: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" aria-label="College actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          // Opening a dialog: keep focus in it (see RowActions).
          onCloseAutoFocus={(e) => (confirmOpen || mergeOpen || inviteOpen) && e.preventDefault()}
        >
          <CollegeShareItems registrationId={registrationId} collegeName={collegeName} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onInvite}>
            <MailPlusIcon /> Invite POC
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
            <GitMergeIcon /> Merge into…
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete from this season
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} collegeId={collegeId} collegeName={collegeName} />
      <DeleteRegistrationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        registrationId={registrationId}
        collegeName={collegeName}
        onDeleted={() => router.push("/admin/colleges")}
      />
    </>
  );
}

/** The POC's league details as admins see them by default: read-only, logos downloadable as the original files. */
function DetailsReadOnly({ details, registrationId }: { details: DetailsFormValues; registrationId: string }) {
  const rows: [string, string][] = [
    ["College email", details.collegeEmail],
    ["Email domain", details.emailDomain && `@${details.emailDomain}`],
    ["Hosted by", details.clubName],
    ["Registration start", formatDay(details.registrationStart)],
    ["League start", formatDay(details.leagueStart)],
    ["League end", formatDay(details.leagueEnd)],
  ];
  return (
    <div className="space-y-4">
      <dl className="glass-surface grid gap-x-6 gap-y-3 rounded-2xl p-4 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
            <dd className="truncate">{value || <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["college", "College logo", details.collegeLogoUrl],
            ["club", "Club logo (Hosted by)", details.clubLogoUrl],
          ] as const
        ).map(([kind, label, url]) => (
          <div key={kind} className="glass-surface flex items-center gap-3 rounded-2xl p-3">
            <span className={`grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ${url ? "bg-white" : "bg-white/6"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from our public bucket */}
              {url ? <img src={url} alt="" className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">None</span>}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
            {url && (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                <a href={`/admin/logos?registration=${registrationId}&kind=${kind}`} download>
                  <DownloadIcon /> Download
                </a>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
