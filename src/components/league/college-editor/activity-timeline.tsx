"use client";

import { HistoryIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "@/components/league/empty-state";
import type { Tables } from "@/lib/database.types";
import {
  formatINR,
  REVIEW_LABELS,
  STAGE_LABELS,
  type ReviewStatus,
  type Stage,
} from "@/lib/league";

type Entry = Tables<"activity_log">;

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function winnerLabel(meta: Entry["meta"]) {
  const m = (meta ?? {}) as { position?: string; name?: string | null };
  return (
    [m.position, m.name ? `(${m.name})` : null].filter(Boolean).join(" ") ||
    "a winner"
  );
}

function describe(e: Entry): string {
  const m = (e.meta ?? {}) as {
    payment_reference?: string | null;
    name?: string | null;
  };
  if (e.entity === "registration") {
    switch (e.field) {
      case "stage":
        return `moved stage ${STAGE_LABELS[e.old_value as Stage] ?? e.old_value} → ${STAGE_LABELS[e.new_value as Stage] ?? e.new_value}`;
      case "status":
        return `changed review ${REVIEW_LABELS[e.old_value as ReviewStatus] ?? e.old_value} → ${REVIEW_LABELS[e.new_value as ReviewStatus] ?? e.new_value}`;
      case "participant_count":
        return `set participants ${e.old_value} → ${e.new_value}`;
      case "prize_pool_override":
        if (e.new_value == null)
          return "removed the prize pool override (back to auto tier)";
        return `set prize pool override ${e.old_value == null ? "" : `${formatINR(Number(e.old_value))} → `}${formatINR(Number(e.new_value))}`;
    }
  }
  if (e.entity === "winner") {
    const who = winnerLabel(e.meta);
    if (e.action === "added") return `added winner ${who}`;
    switch (e.field) {
      case "payment_status":
        return e.new_value === "paid"
          ? `marked ${who} paid${m.payment_reference ? ` · UTR ${m.payment_reference}` : ""}`
          : `marked ${who} unpaid`;
      case "prize_amount":
        return `changed ${who} prize ${formatINR(Number(e.old_value))} → ${formatINR(Number(e.new_value))}`;
      case "merch_sent":
        return e.new_value === "true"
          ? `marked merch sent for ${who}`
          : `marked merch not sent for ${who}`;
      case "upi_id":
        return `updated the UPI ID for ${who}`;
    }
  }
  if (e.entity === "contact" && e.field === "merch_sent") {
    return e.new_value === "true"
      ? `marked merch sent to ${m.name ?? "a contact"}`
      : `marked merch not sent to ${m.name ?? "a contact"}`;
  }
  return `changed ${e.field ?? e.entity}`;
}

/**
 * Who did it: "You", the admin's name (admin mode), "Matiks team" (POC mode, never exposing admin emails),
 * or "System" for changes made outside the app.
 */
function actor(
  e: Entry,
  me: string | null,
  mode: "admin" | "poc",
  adminNames: Record<string, string>,
) {
  if (!e.actor_email) return "System";
  if (me && e.actor_email.toLowerCase() === me.toLowerCase()) return "You";
  if (mode === "poc")
    return adminNames[e.actor_email.toLowerCase()]
      ? "Matiks team"
      : "A college POC";
  return adminNames[e.actor_email.toLowerCase()] ?? e.actor_email;
}

const INITIAL = 8;

export function ActivityTimeline({
  entries,
  me,
  mode,
  adminNames,
}: {
  entries: Entry[];
  me: string | null;
  mode: "admin" | "poc";
  adminNames: Record<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No activity yet"
        description="Stage changes, payouts and merch updates will show up here."
      />
    );
  }
  return (
    <Timeline entries={entries} me={me} mode={mode} adminNames={adminNames} />
  );
}

function Timeline({
  entries,
  me,
  mode,
  adminNames,
}: {
  entries: Entry[];
  me: string | null;
  mode: "admin" | "poc";
  adminNames: Record<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? entries : entries.slice(0, INITIAL);
  return (
    <div className="space-y-3">
      <ol className="relative space-y-4 border-l border-border/60 pl-5">
        {visible.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-sm">
              <span className="font-medium">
                {actor(e, me, mode, adminNames)}
              </span>{" "}
              {describe(e)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {when.format(new Date(e.created_at))}
            </p>
          </li>
        ))}
      </ol>
      {entries.length > INITIAL && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `Show all (${entries.length})`}
        </Button>
      )}
    </div>
  );
}
