"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveAmbassador } from "@/app/admin/(panel)/ambassadors/actions";
import { CollegeSearch } from "@/components/register/college-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type AmbassadorFormValues = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  college: { id: string; name: string } | null;
  referralCode: string;
};

export function AmbassadorDialog({ initial, onClose }: { initial: AmbassadorFormValues; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof AmbassadorFormValues>(k: K, value: AmbassadorFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await saveAmbassador({
                id: v.id,
                name: v.name,
                email: v.email,
                phone: v.phone,
                collegeId: v.college?.id ?? null,
                referralCode: v.referralCode,
              });
              if (!res.ok) return setError(res.error);
              toast.success(v.id ? "Saved" : `Added · ${res.code}`);
              onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{v.id ? `Edit ${initial.name}` : "Add ambassador"}</DialogTitle>
            <DialogDescription>Their link is /register?ref=CODE. Every registration through it is credited to them.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <Field>
              <FieldLabel htmlFor="a-name">Name</FieldLabel>
              <Input id="a-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="a-email">Email</FieldLabel>
                <Input id="a-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="a-phone">Phone</FieldLabel>
                <Input id="a-phone" type="tel" inputMode="numeric" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="college-search">College (optional)</FieldLabel>
              <CollegeSearch
                selectedId={v.college?.id ?? null}
                selectedLabel={v.college?.name ?? ""}
                onSelect={(c) => set("college", { id: c.id, name: c.name })}
                onQueryChange={() => v.college && set("college", null)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="a-code">Referral code</FieldLabel>
              <Input id="a-code" className="font-mono uppercase" placeholder="Leave empty to generate" value={v.referralCode} onChange={(e) => set("referralCode", e.target.value)} />
              {v.id && <FieldDescription>Changing it breaks links already shared with the old code.</FieldDescription>}
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || v.name.trim().length < 2}>
              {pending && <Loader2Icon className="animate-spin" />}
              {v.id ? "Save" : "Add ambassador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
