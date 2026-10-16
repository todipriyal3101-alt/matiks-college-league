"use client";

import { ArrowRightIcon, LinkIcon, MailPlusIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { InvitePocDialog } from "@/components/admin/overview/invite-poc-dialog";
import { DeleteRegistrationDialog } from "@/components/admin/overview/row-actions";
import { ReviewBadge, StageBadge } from "@/components/league/badges";
import { Money } from "@/components/league/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function EditorHeader({
  detail,
  mode,
  readOnly,
  reviewStatus,
  stage,
  onReviewStatus,
  onStage,
}: {
  detail: RegistrationDetail;
  mode: "admin" | "poc";
  readOnly: boolean;
  reviewStatus: ReviewStatus;
  stage: Stage;
  onReviewStatus: (status: ReviewStatus) => void;
  onStage: (stage: Stage) => void;
}) {
  const { register, control, formState } = useFormContext<EditorFormValues>();
  const { registration } = detail;
  const isAdmin = mode === "admin";
  const canAdminWrite = isAdmin && !readOnly;
  const [participants, override] = useWatch({ control, name: ["participantCount", "prizePoolOverride"] });
  const overrideValue = override === "" || override == null ? null : Number(override);
  const pool = effectivePrizePool(Number(participants) || 0, Number.isFinite(overrideValue) ? overrideValue : null);
  const e = formState.errors;

  return (
    <Card className="gap-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-muted-foreground uppercase">{registration.leagues.name}</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{registration.colleges.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[registration.colleges.city, registration.colleges.state].filter(Boolean).join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ReviewBadge status={reviewStatus} />
            <StageBadge stage={stage} />
          </div>
        </div>
        {canAdminWrite && (
          <AdminMenu
            registrationId={registration.id}
            collegeName={registration.colleges.name}
            pocEmail={registration.poc_email}
            approved={reviewStatus === "approved"}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field data-invalid={!!e.teamName}>
          <FieldLabel htmlFor="team-name">Team name</FieldLabel>
          <Input id="team-name" placeholder="e.g. The Integrators" disabled={readOnly} {...register("teamName")} />
          <FieldError errors={[e.teamName]} />
        </Field>
        {canAdminWrite ? (
          <>
            <Field>
              <FieldLabel htmlFor="review-status">Review</FieldLabel>
              <Select value={reviewStatus} onValueChange={(v) => onReviewStatus(v as ReviewStatus)}>
                <SelectTrigger id="review-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {REVIEW_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="stage">Stage</FieldLabel>
              <Select value={stage} onValueChange={(v) => onStage(v as Stage)}>
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        ) : null}
        <Field data-invalid={!!e.participantCount}>
          <FieldLabel htmlFor="participants">Participants</FieldLabel>
          {isAdmin ? (
            <>
              <Input id="participants" type="number" min={0} inputMode="numeric" className="font-mono" disabled={readOnly} {...register("participantCount")} />
              <FieldError errors={[e.participantCount]} />
            </>
          ) : (
            <p className="pt-1.5 font-mono text-lg">{registration.participant_count}</p>
          )}
        </Field>
        {isAdmin && (
          <Field data-invalid={!!e.prizePoolOverride}>
            <FieldLabel htmlFor="override">Prize pool override</FieldLabel>
            <Input id="override" type="number" min={0} inputMode="numeric" placeholder="Auto" className="font-mono" disabled={readOnly} {...register("prizePoolOverride")} />
            <FieldDescription>Leave empty to use the auto tier.</FieldDescription>
            <FieldError errors={[e.prizePoolOverride]} />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/40 p-4">
        <div>
          <div className="text-xs tracking-wider text-muted-foreground uppercase">Auto tier</div>
          <Money amount={pool.auto} className="text-lg" />
        </div>
        <ArrowRightIcon className="size-5 text-muted-foreground" />
        <div>
          <div className="text-xs tracking-wider text-muted-foreground uppercase">Effective prize pool</div>
          <Money amount={pool.amount} className="font-display text-2xl font-bold text-primary" />
        </div>
        {pool.overridden && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">Manually overridden</span>
        )}
      </div>
    </Card>
  );
}

function AdminMenu({
  registrationId,
  collegeName,
  pocEmail,
  approved,
}: {
  registrationId: string;
  collegeName: string;
  pocEmail: string;
  approved: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [invite, setInvite] = useState<"invite" | "approve" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="College actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied");
              } catch {
                toast.error("Couldn't copy the link.");
              }
            }}
          >
            <LinkIcon /> Copy link
          </DropdownMenuItem>
          {!approved && (
            <DropdownMenuItem onSelect={() => setInvite("approve")}>
              <MailPlusIcon /> Approve + invite POC
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setInvite("invite")}>
            <MailPlusIcon /> Invite POC
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete from this season
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InvitePocDialog
        open={invite !== null}
        onOpenChange={(o) => !o && setInvite(null)}
        registrationId={registrationId}
        collegeName={collegeName}
        pocEmail={pocEmail}
        approve={invite === "approve"}
      />
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
