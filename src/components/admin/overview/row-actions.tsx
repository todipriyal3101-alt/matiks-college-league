"use client";

import {
  CheckIcon,
  ClockIcon,
  ImageDownIcon,
  MailPlusIcon,
  LinkIcon,
  MoreHorizontalIcon,
  Settings2Icon,
  Share2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteRegistration } from "@/app/admin/(panel)/overview-actions";
import { download } from "@/components/admin/command-palette";
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
import { absoluteUrl, copyLink, shareLink } from "@/lib/share";

export function RowActions({
  registrationId,
  collegeName,
  reviewStatus,
  pocEmail,
  hasAccess,
  hasLogos = false,
  isWriter,
  onReview,
  onDeny,
  onDeleted,
}: {
  registrationId: string;
  collegeName: string;
  reviewStatus: ReviewStatus;
  pocEmail: string;
  /** The POC already has a login with access (self-registered or invited): approving needs no invite. */
  hasAccess: boolean;
  /** College or club logo uploaded: offers "Download logos" (admins and viewers). */
  hasLogos?: boolean;
  isWriter: boolean;
  onReview: (status: ReviewStatus) => void;
  onDeny: () => void;
  onDeleted?: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [invite, setInvite] = useState<"invite" | "approve" | null>(null);
  const href = `/admin/colleges/${registrationId}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-9 shrink-0" aria-label={`Actions for ${collegeName}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          // Opening a dialog: don't hand focus back to ⋯ when the menu finishes closing, or it pulls focus
          // out of the dialog's field mid-typing.
          onCloseAutoFocus={(e) => (confirmOpen || invite !== null) && e.preventDefault()}
        >
          <DropdownMenuItem asChild>
            <Link href={href}>
              <Settings2Icon /> Manage
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasLogos} onSelect={() => download(`/admin/logos?registration=${registrationId}`)}>
            <ImageDownIcon /> {hasLogos ? "Download logos" : "No logos uploaded"}
          </DropdownMenuItem>
          {/* Viewers see Manage only. */}
          {isWriter && (
            <>
              <CollegeShareItems registrationId={registrationId} collegeName={collegeName} />
              <DropdownMenuSeparator />
              {/* The current status is shown disabled rather than hidden. A POC without a login gets the invite
                  dialog (it also offers "Approve only"). */}
              <DropdownMenuItem
                disabled={reviewStatus === "approved"}
                onSelect={() => (hasAccess ? onReview("approved") : setInvite("approve"))}
              >
                <CheckIcon /> {hasAccess ? "Approve" : "Approve + invite POC"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={reviewStatus === "waitlisted"} onSelect={() => onReview("waitlisted")}>
                <ClockIcon /> Waitlist
              </DropdownMenuItem>
              <DropdownMenuItem disabled={reviewStatus === "rejected"} onSelect={onDeny}>
                <XIcon /> Deny…
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
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}

/** "Share" (the college's admin link: share sheet on phones, else copy) and the POC sign-up link. */
export function CollegeShareItems({ registrationId, collegeName }: { registrationId: string; collegeName: string }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => void shareLink(absoluteUrl(`/admin/colleges/${registrationId}`), collegeName)}>
        <Share2Icon /> Share
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void copyLink(absoluteUrl("/login?mode=signup"))}>
        <LinkIcon /> Copy POC sign-up link
      </DropdownMenuItem>
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
      <AlertDialogContent
        // Alert dialogs focus Cancel by default; here the next step is typing the name.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(`confirm-${registrationId}`)?.focus();
        }}
      >
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
                toast.success(`Deleted · ${collegeName}`);
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
