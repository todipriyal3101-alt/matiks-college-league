"use client";

import { Loader2Icon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { invitePoc } from "@/app/admin/(panel)/overview-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Invite a POC login for one college (defaults to the registration's POC email). */
export function InvitePocDialog({
  open,
  onOpenChange,
  registrationId,
  collegeName,
  pocEmail,
  approve,
  onApproveOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  collegeName: string;
  pocEmail: string;
  approve: boolean;
  /** Shown in approve mode: approve without sending an invite (the POC can't log in until invited). */
  onApproveOnly?: () => void;
}) {
  const [email, setEmail] = useState(pocEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEmail(pocEmail);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setError(null);
            startTransition(async () => {
              const res = await invitePoc(registrationId, { approve, email });
              if (!res.ok) return setError(res.error);
              toast.success(res.message);
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{approve ? "Approve + invite POC" : "Invite POC"}</DialogTitle>
            <DialogDescription>
              {approve ? `Approves ${collegeName} and invites` : "Invites"} this person to manage {collegeName} at /college.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error} className="my-5">
            <FieldLabel htmlFor={`invite-${registrationId}`}>Email</FieldLabel>
            <Input id={`invite-${registrationId}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldDescription>Pre-filled with the email the college registered with.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <DialogFooter>
            {approve && onApproveOnly && (
              <Button type="button" variant="ghost" disabled={pending} onClick={onApproveOnly}>
                Approve only
              </Button>
            )}
            <Button type="submit" disabled={pending || !email}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              {approve ? "Approve and send invite" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
