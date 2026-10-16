"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addCollege } from "@/app/admin/(panel)/overview-actions";
import { CollegeSearch } from "@/components/register/college-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/indian-states";
import { COLLEGE_TYPES, COLLEGE_TYPE_LABELS } from "@/lib/validation/registration";

type NewCollege = { name: string; city: string; state: string; type: (typeof COLLEGE_TYPES)[number] };
const EMPTY_COLLEGE: NewCollege = { name: "", city: "", state: "", type: "other" };

export function AddCollegeDialog({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [college, setCollege] = useState<NewCollege>(EMPTY_COLLEGE);
  const [poc, setPoc] = useState({ name: "", email: "", phone: "" });
  const [invitePoc, setInvitePoc] = useState(true);

  function reset() {
    setError(null);
    setPicked(null);
    setNotListed(false);
    setCollege(EMPTY_COLLEGE);
    setPoc({ name: "", email: "", phone: "" });
    setInvitePoc(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addCollege({
        leagueId,
        collegeId: notListed ? null : (picked?.id ?? null),
        newCollege: notListed ? college : null,
        poc,
        invitePoc,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message, {
        action: { label: "Open", onClick: () => router.push(`/admin/colleges/${res.registrationId}`) },
      });
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Add college
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add college</DialogTitle>
          <DialogDescription>Registers the college for {leagueName} as approved, with its primary POC.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            {!notListed ? (
              <Field>
                <FieldLabel htmlFor="college-search">College</FieldLabel>
                <CollegeSearch
                  selectedId={picked?.id ?? null}
                  selectedLabel={picked?.name ?? ""}
                  onSelect={(c) => setPicked({ id: c.id, name: c.name })}
                  onQueryChange={(q) => {
                    if (picked) setPicked(null);
                    setCollege((c) => ({ ...c, name: q }));
                  }}
                />
                <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => setNotListed(true)}>
                  College isn&apos;t listed
                </Button>
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="new-college-name">College name</FieldLabel>
                  <Input
                    id="new-college-name"
                    value={college.name}
                    onChange={(e) => setCollege({ ...college, name: e.target.value })}
                    placeholder="Indian Institute of Technology Bombay"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="new-college-city">City</FieldLabel>
                    <Input
                      id="new-college-city"
                      value={college.city}
                      onChange={(e) => setCollege({ ...college, city: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-college-state">State</FieldLabel>
                    <Select value={college.state || undefined} onValueChange={(v) => setCollege({ ...college, state: v })}>
                      <SelectTrigger id="new-college-state" className="w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="new-college-type">Type</FieldLabel>
                  <Select value={college.type} onValueChange={(v) => setCollege({ ...college, type: v as NewCollege["type"] })}>
                    <SelectTrigger id="new-college-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLEGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {COLLEGE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => setNotListed(false)}>
                  Search the list instead
                </Button>
              </>
            )}

            <FieldSeparator>Primary POC</FieldSeparator>
            <Field>
              <FieldLabel htmlFor="poc-name">Name</FieldLabel>
              <Input id="poc-name" value={poc.name} onChange={(e) => setPoc({ ...poc, name: e.target.value })} autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="poc-phone">Phone</FieldLabel>
                <Input
                  id="poc-phone"
                  type="tel"
                  inputMode="numeric"
                  value={poc.phone}
                  onChange={(e) => setPoc({ ...poc, phone: e.target.value })}
                  placeholder="10-digit mobile"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="poc-email">Email</FieldLabel>
                <Input
                  id="poc-email"
                  type="email"
                  value={poc.email}
                  onChange={(e) => setPoc({ ...poc, email: e.target.value })}
                  placeholder="They log in with this"
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox id="poc-invite" checked={invitePoc} onCheckedChange={(v) => setInvitePoc(v === true)} />
              <FieldLabel htmlFor="poc-invite" className="font-normal">
                Email the POC an invite to manage this college
              </FieldLabel>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {invitePoc ? "Add, approve + invite POC" : "Add and approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
