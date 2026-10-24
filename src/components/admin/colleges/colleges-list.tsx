"use client";

import { BadgeCheckIcon, CheckIcon, MailWarningIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { denyRegistration, restoreRegistrations, setReviewStatus } from "@/app/admin/(panel)/overview-actions";
import { DenyDialog } from "@/components/admin/colleges/deny-dialog";
import { InvitePocDialog } from "@/components/admin/overview/invite-poc-dialog";
import { RowActions } from "@/components/admin/overview/row-actions";
import { ReviewBadge, StageBadge } from "@/components/league/badges";
import { CollegeLogo } from "@/components/league/college-logo";
import { Button } from "@/components/ui/button";
import type { OverviewRow } from "@/lib/data/league-ops";
import { REVIEW_LABELS, type ReviewStatus, type Stage } from "@/lib/league";
import { stageLine } from "@/lib/stage-line";
import { cn } from "@/lib/utils";

type Dialog = { kind: "deny" | "invite"; row: OverviewRow } | null;

/**
 * All registered colleges: pending first. Approve (+ invite only when the POC has no login yet), Deny with a reason,
 * and the ⋯ menu (Manage, Share, Delete). Clicking a row opens the college editor.
 * Rows use glass-surface (no backdrop blur) so long lists stay fast.
 */
export function CollegesList({ rows, isWriter }: { rows: OverviewRow[]; isWriter: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  // Optimistic review status until the refreshed list arrives.
  const [optimistic, setOptimistic] = useState<Record<string, ReviewStatus>>({});
  const [seen, setSeen] = useState(rows);
  if (seen !== rows) {
    setSeen(rows);
    setOptimistic({});
  }

  function review(row: OverviewRow, status: ReviewStatus) {
    const id = row.registration_id!;
    setOptimistic((o) => ({ ...o, [id]: status }));
    startTransition(async () => {
      const res = await setReviewStatus([id], status);
      if (!res.ok) {
        setOptimistic((o) => ({ ...o, [id]: row.review_status! }));
        toast.error(res.error);
        return;
      }
      toast.success(`${REVIEW_LABELS[status]} · ${row.college_name}`, {
        action: { label: "Undo", onClick: () => startTransition(async () => void (await restoreRegistrations(res.previous))) },
      });
    });
  }

  async function deny(row: OverviewRow, reason: string): Promise<string | null> {
    const res = await denyRegistration(row.registration_id!, reason || null);
    if (!res.ok) return res.error;
    setOptimistic((o) => ({ ...o, [row.registration_id!]: "rejected" }));
    toast.success(`Denied · ${row.college_name}`, {
      action: { label: "Undo", onClick: () => startTransition(async () => void (await restoreRegistrations(res.previous))) },
    });
    return null;
  }

  return (
    <>
      <ul className="space-y-2">
        {rows.map((row) => {
          const id = row.registration_id!;
          const status = optimistic[id] ?? row.review_status!;
          const href = `/admin/colleges/${id}`;
          const needsReview = status !== "approved";
          return (
            <li
              key={id}
              // The whole row opens the editor; buttons and links inside stop that.
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("button, a, [role=menuitem], [role=dialog]")) router.push(href);
              }}
              className="glass-surface grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 rounded-2xl p-3 transition-colors hover:bg-white/9 sm:p-3.5 lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
            >
              <CollegeLogo url={row.college_logo_url} name={row.college_name ?? "?"} />

              <div className="min-w-0">
                <Link href={href} className="block truncate text-[15px] font-bold outline-none hover:underline focus-visible:underline">
                  {row.college_name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <ReviewBadge status={status} />
                  {row.email_verified_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-live px-2 py-0.5 font-semibold text-status-live-fg" title="College email verified">
                      <BadgeCheckIcon className="size-3" aria-hidden /> Verified
                    </span>
                  )}
                  {row.target_players && <span className="rounded-full bg-lilac/15 px-2 py-0.5 font-semibold text-lilac">Target {row.target_players}</span>}
                  {row.domain_mismatch && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-status-pending px-2 py-0.5 font-semibold text-status-pending-fg"
                      title={`POC signed in as ${row.poc_email}, college domain is @${row.email_domain}`}
                    >
                      <MailWarningIcon className="size-3" aria-hidden /> Email domain mismatch
                    </span>
                  )}
                  {status === "rejected" && row.deny_reason ? (
                    <span className="truncate italic">“{row.deny_reason}”</span>
                  ) : row.club_name ? (
                    <span className="truncate">Hosted by {row.club_name}</span>
                  ) : null}
                </div>
              </div>

              {/* Desktop columns: POC, source, stage */}
              <div className="hidden min-w-0 text-sm lg:block">
                <p className="truncate">{row.primary_poc_name ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{row.poc_email}</p>
              </div>
              <div className="hidden min-w-0 text-sm lg:block">
                <p className="truncate">{row.utm_source ?? "direct"}</p>
                <p className="truncate text-xs text-muted-foreground">{row.referral_code ? `ref ${row.referral_code}` : "no referral"}</p>
              </div>
              <div className="hidden min-w-0 lg:block">
                <StageBadge stage={(row.effective_stage ?? "registration_phase") as Stage} className="max-w-full truncate">
                  {stageLine(row)}
                </StageBadge>
              </div>

              <div className={cn("flex items-center gap-1.5", "max-lg:row-start-1 max-lg:col-start-3")}>
                {isWriter && needsReview && (
                  <div className="hidden gap-1.5 sm:flex">
                    <ApproveDeny row={row} status={status} onApprove={() => (row.has_poc_access ? review(row, "approved") : setDialog({ kind: "invite", row }))} onDeny={() => setDialog({ kind: "deny", row })} />
                  </div>
                )}
                <RowActions
                  registrationId={id}
                  collegeName={row.college_name ?? ""}
                  reviewStatus={status}
                  pocEmail={row.poc_email ?? ""}
                  hasAccess={!!row.has_poc_access}
                  hasLogos={!!(row.college_logo_url || row.club_logo_url)}
                  isWriter={isWriter}
                  onReview={(s) => review(row, s)}
                  onDeny={() => setDialog({ kind: "deny", row })}
                />
              </div>

              {/* Phones: POC + source + stage under the name, then full-width Approve / Deny */}
              <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
                <span className="truncate">{row.primary_poc_name ?? row.poc_email}</span>
                <span>·</span>
                <span>{row.utm_source ?? "direct"}{row.referral_code ? ` · ref ${row.referral_code}` : ""}</span>
                <StageBadge stage={(row.effective_stage ?? "registration_phase") as Stage}>{stageLine(row)}</StageBadge>
              </div>
              {isWriter && needsReview && (
                <div className="col-span-3 flex gap-2 sm:hidden">
                  <ApproveDeny row={row} status={status} wide onApprove={() => (row.has_poc_access ? review(row, "approved") : setDialog({ kind: "invite", row }))} onDeny={() => setDialog({ kind: "deny", row })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <DenyDialog
        open={dialog?.kind === "deny"}
        onOpenChange={(o) => !o && setDialog(null)}
        collegeName={dialog?.row.college_name ?? ""}
        onDeny={(reason) => deny(dialog!.row, reason)}
      />
      {dialog?.kind === "invite" && (
        <InvitePocDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          registrationId={dialog.row.registration_id!}
          collegeName={dialog.row.college_name ?? ""}
          pocEmail={dialog.row.poc_email ?? ""}
          approve
          onApproveOnly={() => {
            const row = dialog.row;
            setDialog(null);
            review(row, "approved");
          }}
        />
      )}
    </>
  );
}

function ApproveDeny({
  row,
  status,
  wide,
  onApprove,
  onDeny,
}: {
  row: OverviewRow;
  status: ReviewStatus;
  wide?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <>
      <Button type="button" size="sm" className={cn("h-9 rounded-full px-3.5", wide && "h-11 flex-1")} onClick={onApprove}>
        <CheckIcon /> {row.has_poc_access ? "Approve" : "Approve + invite"}
      </Button>
      {status !== "rejected" && (
        <Button type="button" size="sm" variant="destructive" className={cn("h-9 rounded-full px-3.5", wide && "h-11 flex-1")} onClick={onDeny}>
          <XIcon /> Deny
        </Button>
      )}
    </>
  );
}
