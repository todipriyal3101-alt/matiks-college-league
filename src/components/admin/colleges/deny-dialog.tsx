"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** "Deny" asks for an optional reason; the POC sees it on their Register tab, in the notification and the email. */
export function DenyDialog({
  open,
  onOpenChange,
  collegeName,
  onDeny,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collegeName: string;
  /** Resolves to an error message, or null when done. */
  onDeny: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (!o) {
          setReason("");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const err = await onDeny(reason);
              if (err) return setError(err);
              setReason("");
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Deny {collegeName}?</DialogTitle>
            <DialogDescription>The POC is notified. They can fix their details and resubmit.</DialogDescription>
          </DialogHeader>
          <Field className="my-5" data-invalid={!!error}>
            <FieldLabel htmlFor="deny-reason">Reason (optional)</FieldLabel>
            <Textarea id="deny-reason" value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The dates clash with exams. Please pick dates after 20 Nov." />
            <FieldDescription>{error ?? "Shown to the POC."}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Deny
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
