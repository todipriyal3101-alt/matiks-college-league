import { REVIEW_LABELS, STAGE_LABELS, type ReviewStatus, type Stage } from "@/lib/league";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const STAGE_STYLES: Record<Stage, string> = {
  registration_phase: "bg-status-registration text-status-registration-fg",
  live: "bg-status-live text-status-live-fg",
  ended_prize_pending: "bg-status-pending text-status-pending-fg",
  ended_prize_sent: "bg-status-done text-status-done-fg",
};

/** Season stage: Registration / Live / Prize pending / Complete. */
export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return <span className={cn(pill, STAGE_STYLES[stage], className)}>{STAGE_LABELS[stage]}</span>;
}

const REVIEW_STYLES: Record<ReviewStatus, string> = {
  pending: "bg-status-pending text-status-pending-fg",
  approved: "bg-status-live text-status-live-fg",
  waitlisted: "bg-status-registration text-status-registration-fg",
  rejected: "bg-destructive/20 text-destructive",
};

/** Admin review status: Pending review / Approved / Waitlisted / Rejected. */
export function ReviewBadge({ status, className }: { status: ReviewStatus; className?: string }) {
  return <span className={cn(pill, REVIEW_STYLES[status], className)}>{REVIEW_LABELS[status]}</span>;
}

/** Done/pending pill for payment and merch: green when ok, amber otherwise. */
export function PillBadge({
  ok,
  labelOk,
  labelPending,
  className,
}: {
  ok: boolean;
  labelOk: string;
  labelPending: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        pill,
        "px-2",
        ok ? "bg-status-live text-status-live-fg" : "bg-status-pending text-status-pending-fg",
        className,
      )}
    >
      {ok ? labelOk : labelPending}
    </span>
  );
}
