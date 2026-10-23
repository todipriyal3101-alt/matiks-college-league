"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateMyProfile } from "@/app/college/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { profileSchema } from "@/lib/validation/portal";

/** The POC's own name and phone (their account). */
export function ProfileForm({ initial, email }: { initial: { name: string; phone: string }; email: string }) {
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const dirty = value.name !== initial.name || value.phone !== initial.phone;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = profileSchema.safeParse(value);
        if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        setErrors({});
        startTransition(async () => {
          const res = await updateMyProfile(value);
          if (!res.ok) toast.error(res.error);
          else toast.success("Profile saved");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="profile-name">Your name</FieldLabel>
          <Input id="profile-name" autoComplete="name" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} className="h-12" />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="profile-phone">Phone (WhatsApp)</FieldLabel>
          <Input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} className="h-12 font-mono" />
          <FieldError>{errors.phone}</FieldError>
        </Field>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FieldDescription>Signed in as {email}. Your college&apos;s contact cards are below.</FieldDescription>
        <Button type="submit" className="h-11 rounded-full px-6" disabled={!dirty || pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Save profile
        </Button>
      </div>
    </form>
  );
}
