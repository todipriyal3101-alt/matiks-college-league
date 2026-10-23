"use client";

import { BellRingIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendPocNotification } from "@/app/admin/(panel)/pocs/actions";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRY_LABELS, pocNotificationSchema, type Country } from "@/lib/validation/portal";

type Scope = "all" | "approved" | "college";

/** Send an in-app notification (+ email when Resend is set up) to all POCs, approved colleges only, or one college. */
export function NotifyDialog({ country, colleges }: { country: Country; colleges: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setBody("");
    setScope("all");
    setRegistrationId(null);
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { title, body, scope, country, registrationId };
    const parsed = pocNotificationSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    startTransition(async () => {
      const res = await sendPocNotification(input);
      if (!res.ok) {
        setErrors({ [res.field ?? "form"]: res.error });
        return;
      }
      toast.success(res.sent ? `Sent to ${res.sent} POC${res.sent === 1 ? "" : "s"}` : "Nobody matched: no POC logins yet", {
        description: res.sent ? (res.emailed ? "In-app and by email." : "In-app (email isn't set up).") : undefined,
      });
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 rounded-full px-5">
          <BellRingIcon /> Send notification
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Notify POCs</DialogTitle>
            <DialogDescription>Shows in their bell in the college portal{scope !== "college" ? ` · ${COUNTRY_LABELS[country]} colleges` : ""}.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Send to</FieldLabel>
            <SegmentedControl
              label="Send to"
              className="self-start"
              value={scope}
              onChange={(s) => {
                setScope(s);
                setErrors({});
              }}
              options={[
                { value: "all", label: "All POCs" },
                { value: "approved", label: "Approved" },
                { value: "college", label: "One college" },
              ]}
            />
            <FieldDescription>{scope === "all" ? "Everyone except denied colleges." : scope === "approved" ? "Only approved colleges." : "Pick the college below."}</FieldDescription>
          </Field>
          {scope === "college" && (
            <Field data-invalid={!!errors.registrationId}>
              <FieldLabel htmlFor="notify-college">College</FieldLabel>
              <Select value={registrationId ?? undefined} onValueChange={setRegistrationId}>
                <SelectTrigger id="notify-college" className="h-11 w-full" aria-invalid={!!errors.registrationId}>
                  <SelectValue placeholder="Pick a college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.registrationId}</FieldError>
            </Field>
          )}
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="notify-title">Title</FieldLabel>
            <Input id="notify-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="e.g. League week starts Monday" />
            <FieldError>{errors.title}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="notify-body">Message (optional)</FieldLabel>
            <Textarea id="notify-body" value={body} maxLength={2000} rows={4} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11">
              {pending && <Loader2Icon className="animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
