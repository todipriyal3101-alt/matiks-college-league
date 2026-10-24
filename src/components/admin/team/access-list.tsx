"use client";

import { MailWarningIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revokeAccess } from "@/app/admin/(panel)/team/actions";
import { EmptyState } from "@/components/league/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AccessEntry = {
  key: string;
  userId: string;
  email: string;
  name: string | null;
  role: "admin" | "viewer" | "poc";
  registrationId: string | null;
  college: string | null;
  season: string | null;
  lastSignInAt: string | null;
  /** Email proven by a link or Google (0009); unverified accounts are flagged. */
  verified: boolean;
  isMe: boolean;
};

const ROLE_LABEL = { admin: "Admin", viewer: "Viewer", poc: "College POC" } as const;
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function AccessList({ entries, canWrite }: { entries: AccessEntry[]; canWrite: boolean }) {
  const [revoking, setRevoking] = useState<AccessEntry | null>(null);
  const [, startTransition] = useTransition();

  if (entries.length === 0) {
    return <EmptyState icon={ShieldIcon} title="Nobody has access yet" description="Give an admin or a college POC access above." />;
  }

  return (
    <>
      <ul className="divide-y divide-border/60 rounded-2xl border bg-card">
        {entries.map((e) => (
          <li key={e.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate text-sm font-medium">
                {e.name ?? e.email}
                {e.isMe && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
              </p>
              {e.name && <p className="truncate text-xs text-muted-foreground">{e.email}</p>}
            </div>
            <div className="basis-48 text-sm">
              <Badge variant={e.role === "admin" ? "default" : "secondary"}>{ROLE_LABEL[e.role]}</Badge>
              {e.college && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {e.college} · {e.season}
                </p>
              )}
            </div>
            <div className="basis-40 space-y-1 text-xs">
              <p className={e.lastSignInAt ? "text-muted-foreground" : "text-status-pending-fg"}>
                {e.lastSignInAt ? `Last sign-in ${when.format(new Date(e.lastSignInAt))}` : "Never signed in"}
              </p>
              {!e.verified && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-status-pending px-2 py-0.5 font-semibold text-status-pending-fg"
                  title="Signed up without proving they own this email (no link or Google sign-in yet)"
                >
                  <MailWarningIcon className="size-3" aria-hidden /> Email not verified
                </span>
              )}
            </div>
            {canWrite && (
              <div className="ml-auto flex gap-1">
                {/* You can't remove your own admin access; dropping your own POC access is fine. */}
                {!(e.isMe && e.role !== "poc") && (
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setRevoking(e)} aria-label={`Revoke ${e.email}`}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {revoking?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking?.role === "poc"
                ? `They'll no longer see ${revoking.college} (${revoking.season}).`
                : "They'll lose access to the admin panel immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const r = revoking!;
                setRevoking(null);
                startTransition(async () => {
                  const res = await revokeAccess(
                    r.role === "poc" ? { kind: "poc", userId: r.userId, registrationId: r.registrationId! } : { kind: "admin", userId: r.userId },
                  );
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.error);
                });
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
