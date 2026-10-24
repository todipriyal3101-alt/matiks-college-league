"use client";

import { BadgeCheckIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { checkVerificationCode, sendVerificationCode } from "@/app/college/register-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Optional "Verified" fast lane: a 6-digit code to the college email (hashed, 10-min expiry, 5 tries; limits live in
 * the database). Without Resend configured it says "Verification coming soon" and the step can be skipped.
 */
export function VerifyEmail({ email, enabled, verified, onVerified }: { email: string; enabled: boolean; verified: boolean; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (verified) {
    return (
      <p className="flex items-center gap-3 rounded-2xl bg-status-live/60 px-4 py-4 font-semibold text-status-live-fg">
        <BadgeCheckIcon className="size-6 shrink-0" aria-hidden /> {email} is verified. You&apos;ll get the Verified badge.
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="rounded-2xl bg-white/4 px-4 py-4 text-sm text-foreground/85">
        <span className="font-semibold">Verification coming soon.</span> Skip this step for now; it won&apos;t slow down your review.
      </p>
    );
  }

  const send = () =>
    start(async () => {
      const res = await sendVerificationCode(email);
      if (!res.ok) return void toast.error(res.error);
      setSent(true);
      setMessage(null);
      toast.success(`Code sent to ${email}`);
    });

  const check = () =>
    start(async () => {
      const res = await checkVerificationCode(email, code);
      if (!res.ok) return setMessage(res.error);
      if (res.verified) {
        toast.success("Verified!");
        onVerified();
      } else setMessage(res.message ?? "Wrong code.");
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/85">
        We&apos;ll email a 6-digit code to <span className="font-semibold">{email}</span>. Verified colleges get a badge and are reviewed first.
      </p>
      {!sent ? (
        <Button type="button" variant="outline" className="h-12 rounded-full" onClick={send} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Send code
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="verify-code" className="text-sm font-semibold">
            6-digit code
          </label>
          <div className="flex gap-2">
            <Input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (code.length === 6) check();
                }
              }}
              className="h-12 max-w-44 text-center font-mono text-xl tracking-[0.4em]"
              aria-invalid={!!message || undefined}
              aria-describedby={message ? "verify-msg" : undefined}
            />
            <Button type="button" className="h-12 rounded-full px-5" onClick={check} disabled={pending || code.length !== 6}>
              {pending && <Loader2Icon className="animate-spin" />} Verify
            </Button>
          </div>
          {message && (
            <p id="verify-msg" role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <button type="button" onClick={send} disabled={pending} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Send a new code
          </button>
        </div>
      )}
    </div>
  );
}
