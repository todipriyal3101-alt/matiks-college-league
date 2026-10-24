"use client";

import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteAccess } from "@/app/admin/(panel)/team/actions";
import { AccessMessage } from "@/components/admin/access-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "admin" | "viewer" | "poc";
const ROLE_HELP: Record<Role, string> = {
  admin: "Full access: edit everything, approve, pay, export, manage access.",
  viewer: "Read-only access to the admin panel. No edits, no exports.",
  poc: "Sees and edits only their college: team name, contacts, winner details.",
};

export function InviteForm({ colleges, seasonName }: { colleges: { id: string; name: string }[]; seasonName: string }) {
  const [role, setRole] = useState<Role>("poc");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="gap-4 p-5 sm:p-6">
      <div>
        <h2 className="text-2xl">Give access</h2>
        <p className="text-sm text-muted-foreground">
          No emails are sent. Existing accounts get access straight away; a POC without an account gets it when they sign up with that email (share the WhatsApp message).
        </p>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setShare(null);
          startTransition(async () => {
            const res = await inviteAccess(role === "poc" ? { role, email, registrationId } : { role, email, name });
            setShare(res.whatsapp ?? null);
            if (!res.ok) return setError(res.error);
            toast.success(res.message);
            setEmail("");
            setName("");
            setRegistrationId("");
          });
        }}
      >
        <Field>
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="poc">College POC</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="lg:col-span-1">
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === "poc" ? "poc@college.edu" : "name@matiks.com"} />
        </Field>
        {role === "poc" ? (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="invite-college">College ({seasonName})</FieldLabel>
            <Select value={registrationId} onValueChange={setRegistrationId}>
              <SelectTrigger id="invite-college" className="w-full">
                <SelectValue placeholder={colleges.length ? "Select college" : "No colleges this season"} />
              </SelectTrigger>
              <SelectContent>
                {colleges.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="invite-name">Name (optional)</FieldLabel>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
          <FieldDescription>{ROLE_HELP[role]}</FieldDescription>
          <Button type="submit" disabled={pending || !email || (role === "poc" && !registrationId)}>
            {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
            Give access
          </Button>
        </div>
        {error && <FieldError className="sm:col-span-2 lg:col-span-4">{error}</FieldError>}
        {share && (
          <div className="sm:col-span-2 lg:col-span-4">
            <AccessMessage message={share} />
          </div>
        )}
      </form>
    </Card>
  );
}
