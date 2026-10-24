"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The message an admin shares when someone has no account yet (no emails, migration 0009): sign-up link + the exact
 * email to use. Copy it, or open WhatsApp with it.
 */
export function AccessMessage({ message }: { message: string }) {
  return (
    <div className="space-y-3 rounded-2xl bg-white/5 p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
      <p className="text-sm whitespace-pre-wrap">{message}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success("Message copied. Paste it in WhatsApp."))}
        >
          <CopyIcon /> Copy WhatsApp message
        </Button>
        <Button asChild type="button" size="sm" variant="outline" className="rounded-full">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">
            <MessageCircleIcon /> Open WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

/** The same, in a dialog (after "Add college" or "Approve + add POC" closes its own dialog). */
export function AccessMessageDialog({ message, onClose, title = "Share the sign-up link" }: { message: string | null; onClose: () => void; title?: string }) {
  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            They don&apos;t have an account yet. When they sign up with this exact email (within 14 days), they get access automatically.
          </DialogDescription>
        </DialogHeader>
        {message && <AccessMessage message={message} />}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
