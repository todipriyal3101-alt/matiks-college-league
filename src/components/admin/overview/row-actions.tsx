"use client";

import {
  CheckIcon,
  ClockIcon,
  MailPlusIcon,
  LinkIcon,
  MoreHorizontalIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteRegistration } from "@/app/admin/(panel)/overview-actions";
import { InvitePocDialog } from "@/components/admin/overview/invite-poc-dialog";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ReviewStatus } from "@/lib/league";

export function RowActions({
  registrationId,
  collegeName,
  reviewStatus,
  pocEmail,
  isWriter,
  onReview,
}: {
  registrationId: string;
  collegeName: string;
  reviewStatus: ReviewStatus;
  pocEmail: string;
  isWriter: boolean;
  onReview: (status: ReviewStatus) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [invite, setInvite] = useState<"invite" | "approve" | null>(null);
  const href = `/admin/colleges/${registrationId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${collegeName}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={href}>
              <Settings2Icon /> Manage
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyLink}>
            <LinkIcon /> Copy link
          </DropdownMenuItem>
          {isWriter && (
            <>
              <DropdownMenuSeparator />
              {/* The current status is shown disabled rather than hidden. */}
              {/* Approving goes through the invite dialog (it also offers "Approve only"): sign-ups are off,
                  so a POC can only log in once invited. */}
              <DropdownMenuItem disabled={reviewStatus === "approved"} onSelect={() => setInvite("approve")}>
                <CheckIcon /> Approve + invite POC
              </DropdownMenuItem>
              <DropdownMenuItem disabled={reviewStatus === "waitlisted"} onSelect={() => onReview("waitlisted")}>
                <ClockIcon /> Waitlist
              </DropdownMenuItem>
              <DropdownMenuItem disabled={reviewStatus === "rejected"} onSelect={() => onReview("rejected")}>
                <XIcon /> Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setInvite("invite")}>
                <MailPlusIcon /> Invite POC
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isWriter && (
        <InvitePocDialog
          open={invite !== null}
          onOpenChange={(o) => !o && setInvite(null)}
          registrationId={registrationId}
          collegeName={collegeName}
          pocEmail={pocEmail}
          approve={invite === "approve"}
          onApproveOnly={() => {
            setInvite(null);
            onReview("approved");
          }}
        />
      )}
      {isWriter && (
        <DeleteRegistrationDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          registrationId={registrationId}
          collegeName={collegeName}
        />
      )}
    </>
  );
}

/** Delete with a typed-name confirmation (SPEC "UX rules"). */
export function DeleteRegistrationDialog({
  open,
  onOpenChange,
  registrationId,
  collegeName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  collegeName: string;
  onDeleted?: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === collegeName.trim().toLowerCase();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {collegeName} from this season?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes this season&apos;s registration with its contacts, participants, winners,
            POC access and activity. The college itself stays in the master list. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor={`confirm-${registrationId}`} className="text-sm text-muted-foreground">
            Type <strong className="text-foreground">{collegeName}</strong> to confirm
          </label>
          <Input
            id={`confirm-${registrationId}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!matches || pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteRegistration(registrationId, typed);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(`${collegeName} deleted from this season`);
                onOpenChange(false);
                onDeleted?.();
              });
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
