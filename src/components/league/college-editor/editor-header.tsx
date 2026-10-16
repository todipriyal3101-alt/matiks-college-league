"use client";

import {
  ArrowRightIcon,
  BanknoteIcon,
  CheckIcon,
  GitMergeIcon,
  LinkIcon,
  MailPlusIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { InvitePocDialog } from "@/components/admin/overview/invite-poc-dialog";
import { DeleteRegistrationDialog } from "@/components/admin/overview/row-actions";
import { ReviewBadge, StageBadge } from "@/components/league/badges";
import { Money } from "@/components/league/money";
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
  unpaid,
  onReviewStatus,
  onStage,
  onMarkPaid,
}: {
  detail: RegistrationDetail;
  mode: "admin" | "poc";
  readOnly: boolean;
  reviewStatus: ReviewStatus;
  stage: Stage;
  /** Saved winners not yet paid (admin "Mark paid" menu). */
  unpaid: { id: string; label: string }[];
  onReviewStatus: (status: ReviewStatus) => void;
  onStage: (stage: Stage) => void;
  onMarkPaid: (winnerId: string) => void;
}) {
  const { registration } = detail;
  const canAdminWrite = mode === "admin" && !readOnly;
  // Approving always goes through the invite dialog: with sign-ups off, a POC can only log in once invited.
  const [invite, setInvite] = useState<"invite" | "approve" | null>(null);

  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {registration.leagues.name}
            {registration.colleges.city && ` · ${registration.colleges.city}`}
          </p>
          <h1 className="truncate text-3xl sm:text-4xl">{registration.colleges.name}</h1>
        </div>
        {canAdminWrite && (
          <AdminMenu
            registrationId={registration.id}
            collegeId={registration.colleges.id}
            collegeName={registration.colleges.name}
            onInvite={() => setInvite("invite")}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canAdminWrite ? (
          <>
            {reviewStatus !== "approved" && (
              <Button type="button" size="sm" className="h-9" onClick={() => setInvite("approve")}>
                <CheckIcon /> Approve + invite
              </Button>
            )}
            <Select value={reviewStatus} onValueChange={(v) => (v === "approved" ? setInvite("approve") : onReviewStatus(v as ReviewStatus))}>
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
            <Select value={stage} onValueChange={(v) => onStage(v as Stage)}>
              <SelectTrigger id="stage" size="sm" aria-label="Stage" className="w-auto gap-1.5 data-[size=sm]:h-9">
                <StageBadge stage={stage} />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
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
      </div>

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

/** Overview tab: team name, participants and the prize pool. */
export function OverviewPanel({ mode, readOnly, participantCount }: { mode: "admin" | "poc"; readOnly: boolean; participantCount: number }) {
  const { register, control, formState } = useFormContext<EditorFormValues>();
  const isAdmin = mode === "admin";
  const [participants, override] = useWatch({ control, name: ["participantCount", "prizePoolOverride"] });
  const overrideValue = override === "" || override == null ? null : Number(override);
  const pool = effectivePrizePool(Number(participants) || 0, Number.isFinite(overrideValue) ? overrideValue : null);
  const e = formState.errors;

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
              Prize override
              <Tooltip>
                <TooltipTrigger type="button" className="text-muted-foreground" aria-label="About the override">
                  ⓘ
                </TooltipTrigger>
                <TooltipContent>Empty = auto tier from participants</TooltipContent>
              </Tooltip>
            </FieldLabel>
            <Input id="override" type="number" min={0} inputMode="numeric" placeholder="Auto" className="font-mono" disabled={readOnly} {...register("prizePoolOverride")} />
            <FieldError errors={[e.prizePoolOverride]} />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Auto tier</div>
          <Money amount={pool.auto} className="text-lg" />
        </div>
        <ArrowRightIcon className="size-5 text-muted-foreground" />
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Prize pool</div>
          <Money amount={pool.amount} className="font-display text-4xl leading-none text-primary" />
        </div>
        {pool.overridden && <span className="rounded-full bg-lilac/15 px-2 py-0.5 text-xs font-semibold text-lilac">Overridden</span>}
      </div>
    </div>
  );
}

function AdminMenu({
  registrationId,
  collegeId,
  collegeName,
  onInvite,
}: {
  registrationId: string;
  collegeId: string;
  collegeName: string;
  onInvite: () => void;
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Copied");
              } catch {
                toast.error("Couldn't copy the link.");
              }
            }}
          >
            <LinkIcon /> Copy link
          </DropdownMenuItem>
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
        onDeleted={() => router.push("/admin")}
      />
    </>
  );
}
