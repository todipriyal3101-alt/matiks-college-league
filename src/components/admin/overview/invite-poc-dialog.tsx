"use client";

import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { invitePoc } from "@/app/admin/(panel)/overview-actions";
import { AccessMessage } from "@/components/admin/access-message";
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

/** Give a POC access to one college (defaults to the registration's POC email). Never sends email (0009). */
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
  /** Shown in approve mode: approve without adding a POC (no one can sign in to it until added). */
  onApproveOnly?: () => void;
}) {
  const [email, setEmail] = useState(pocEmail);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEmail(pocEmail);
          setError(null);
          setShare(null);
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
              // No account yet: keep the dialog open with the message to share.
              if (res.whatsapp) setShare(res.whatsapp);
              else onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{share ? "Share the sign-up link" : approve ? "Approve + add POC" : "Add POC"}</DialogTitle>
            <DialogDescription>
              {share
                ? "They don't have an account yet. When they sign up with this exact email (within 14 days), they get access automatically."
                : `${approve ? `Approves ${collegeName} and gives` : "Gives"} this person access to manage ${collegeName} at /college. No email is sent.`}
            </DialogDescription>
          </DialogHeader>
          {share ? (
            <div className="my-5">
              <AccessMessage message={share} />
            </div>
          ) : (
          <Field data-invalid={!!error} className="my-5">
            <FieldLabel htmlFor={`invite-${registrationId}`}>Email</FieldLabel>
            <Input id={`invite-${registrationId}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldDescription>Pre-filled with the email the college registered with.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          )}
          <DialogFooter>
            {share && (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            )}
            {!share && approve && onApproveOnly && (
              <Button type="button" variant="ghost" disabled={pending} onClick={onApproveOnly}>
                Approve only
              </Button>
            )}
            {!share && (
              <Button type="submit" disabled={pending || !email}>
                {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
                {approve ? "Approve + add POC" : "Add POC"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
