import { CheckIcon, MessageCircleIcon, PencilIcon, XIcon } from "lucide-react";
import Link from "next/link";

import { Glass } from "@/components/glass";
import { ApprovedCelebration } from "@/components/portal/approved-celebration";
import { EmptyStateSticker } from "@/components/stickers";
import { Button } from "@/components/ui/button";
import type { OverviewRow } from "@/lib/data/league-ops";
import { formatDay, istDateTime } from "@/lib/ist";
import { cn } from "@/lib/utils";

type Step = { label: string; done: boolean; at?: string | null; hint?: string; bad?: boolean };

const when = (iso: string | null | undefined) => (iso ? istDateTime.format(new Date(iso)) : null);

/**
 * Order-tracking status: Submitted ✓ → Under review (an admin opened it) → Approved → League live → Complete, with
 * times. Denied shows the reason + "Edit & resubmit"; the first view of Approved celebrates.
 */
export function StatusTracker({ row }: { row: OverviewRow }) {
  const status = row.review_status ?? "pending";
  const stage = row.effective_stage ?? "registration_phase";
  const approved = status === "approved";
  const denied = status === "rejected";
  const live = approved && stage !== "registration_phase";
  const ended = approved && (stage === "ended_prize_pending" || stage === "ended_prize_sent");
  const viewed = !!row.admin_first_viewed_at || approved || denied || status === "waitlisted";

  const steps: Step[] = [
    { label: "Submitted", done: true, at: when(row.created_at) },
    { label: "Under review", done: viewed, at: when(row.admin_first_viewed_at), hint: viewed ? "An admin opened it" : "Waiting for an admin" },
    denied
      ? { label: "Not approved", done: true, bad: true, at: when(row.reviewed_at) }
      : status === "waitlisted"
        ? { label: "Waitlisted", done: false, hint: "We'll tell you here if a spot opens up" }
        : { label: "Approved", done: approved, at: when(row.reviewed_at), hint: approved ? undefined : "Usually within a day" },
    { label: "League live", done: live, hint: row.league_start ? formatDay(row.league_start) : "Your league week" },
    { label: "Complete", done: ended, hint: row.league_end ? `${formatDay(row.league_end)} · add your winners` : "Add your winners" },
  ];
  const current = steps.findIndex((s) => !s.done);
  const title = denied ? "Not approved" : ended ? "Complete" : live ? "League live" : approved ? "Approved" : status === "waitlisted" ? "Waitlisted" : viewed ? "Under review" : "Submitted";
  const sub = denied
    ? "Fix the details below and resubmit, or message us in Chat."
    : ended
      ? "Add your winners in the Winners tab so we can pay the prizes."
      : live
        ? "Your league is on. Rally your batch!"
        : approved
          ? "You're in! Share your college card and invite link."
          : "Usually within a day. We'll notify you here and by email.";

  return (
    <Glass className="relative space-y-5 p-5 sm:p-6">
      {approved && <ApprovedCelebration registrationId={row.registration_id!} college={row.college_name ?? "Your college"} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Status</p>
          <h2 className="mt-1 text-4xl sm:text-5xl">{title}</h2>
          <p className="mt-1 text-sm text-foreground/85">{sub}</p>
        </div>
        <EmptyStateSticker name={approved ? "trophy" : "streak"} className="mx-0 w-16 shrink-0 sm:w-20" />
      </div>

      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className={cn("absolute top-7 bottom-0.5 left-[11px] w-0.5", s.done && steps[i + 1].done ? "bg-primary" : "bg-white/12")} />
            )}
            <span
              aria-hidden
              className={cn(
                "relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                s.bad ? "bg-destructive text-white" : s.done ? "bg-primary text-black" : i === current ? "bg-status-pending text-status-pending-fg shadow-[0_0_0_5px_rgb(255_210_122/0.1)]" : "bg-white/8 text-muted-foreground",
              )}
            >
              {s.bad ? <XIcon className="size-3.5" /> : s.done ? <CheckIcon className="size-3.5" /> : i === current ? "●" : i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-bold">
                {s.label}
                <span className="sr-only">{s.bad ? " (not approved)" : s.done ? " (done)" : i === current ? " (in progress)" : ""}</span>
              </p>
              <p className="text-xs text-muted-foreground">{[s.at, s.hint].filter(Boolean).join(" · ")}</p>
            </div>
          </li>
        ))}
      </ol>

      {denied && (
        <div className="space-y-3 rounded-2xl bg-destructive/10 p-4">
          {row.deny_reason && (
            <p className="text-sm">
              <span className="font-semibold">Reason:</span> {row.deny_reason}
            </p>
          )}
          <Button asChild className="h-11 rounded-full">
            <a href="#details">
              <PencilIcon /> Edit &amp; resubmit
            </a>
          </Button>
        </div>
      )}

      <Button asChild variant="outline" className="h-11 rounded-full">
        <Link href="/college/chat">
          <MessageCircleIcon /> Chat with us
        </Link>
      </Button>
    </Glass>
  );
}
