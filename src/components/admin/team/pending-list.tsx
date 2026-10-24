"use client";

import { ClockIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revokePendingAccess } from "@/app/admin/(panel)/team/actions";
import { AccessMessage } from "@/components/admin/access-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PendingEntry = { id: string; email: string; college: string; season: string; expiresAt: string; message: string };

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * POC access waiting for a sign-up with that exact email (0009). Expired entries no longer work; writers can copy the
 * WhatsApp message again or revoke.
 */
export function PendingList({ entries, canWrite, now }: { entries: PendingEntry[]; canWrite: boolean; now: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!entries.length) return null;

  return (
    <ul className="divide-y divide-border/60 rounded-2xl border bg-card">
      {entries.map((e) => {
        const expired = new Date(e.expiresAt).getTime() <= now;
        return (
          <li key={e.id} className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-medium">{e.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.college} · {e.season}
                </p>
              </div>
              <Badge variant="secondary">College POC</Badge>
              <p className={`flex basis-40 items-center gap-1 text-xs ${expired ? "text-destructive" : "text-status-pending-fg"}`}>
                <ClockIcon className="size-3.5" aria-hidden />
                {expired ? "Expired (add them again)" : `Waiting for sign-up · until ${day.format(new Date(e.expiresAt))}`}
              </p>
              {canWrite && (
                <div className="ml-auto flex gap-1">
                  {!expired && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                      WhatsApp message
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={pending}
                    aria-label={`Revoke pending access for ${e.email}`}
                    onClick={() =>
                      start(async () => {
                        const res = await revokePendingAccess(e.id);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.error);
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )}
            </div>
            {open === e.id && <AccessMessage message={e.message} />}
          </li>
        );
      })}
    </ul>
  );
}
