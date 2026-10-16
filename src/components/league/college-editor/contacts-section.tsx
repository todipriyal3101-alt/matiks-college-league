"use client";

import { PlusIcon, StarIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";

import { CopyButton } from "@/components/league/copy-button";
import { EmptyState } from "@/components/league/empty-state";
import { PillBadge } from "@/components/league/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import { TSHIRT_SIZES } from "@/lib/validation/league-ops";

import { EMPTY_CONTACT, type EditorFormValues } from "./form-values";
import { SectionHeader } from "./section-header";

export function ContactsSection({
  saved,
  isAdmin,
  readOnly,
  merchSent,
  onMerchSent,
}: {
  /** Contacts as stored (for primary flag and merch status). */
  saved: Tables<"contacts">[];
  isAdmin: boolean;
  readOnly: boolean;
  merchSent: (contactId: string) => boolean;
  onMerchSent: (contactId: string, sent: boolean) => void;
}) {
  const { control, register, formState } = useFormContext<EditorFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "contacts", keyName: "key" });
  const errors = formState.errors.contacts;

  return (
    <section>
      <SectionHeader
        title="Points of contact"
        subtitle="1 primary contact, up to 2 more."
        action={
          !readOnly && fields.length < 3 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => append(EMPTY_CONTACT)}>
              <PlusIcon /> Add contact
            </Button>
          ) : null
        }
      />
      {fields.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No contacts yet" description="Add the primary contact to get started." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map((field, i) => {
            const stored = saved.find((c) => c.id === field.id);
            // Unsaved first contact becomes primary on save (database trigger).
            const isPrimary = stored ? stored.is_primary : i === 0 && saved.length === 0;
            const e = errors?.[i];
            return (
              <Card key={field.key} className="gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    {isPrimary && <StarIcon className="size-4 fill-primary text-primary" />}
                    {isPrimary ? "Primary POC" : "POC"}
                    {!stored && <span className="normal-case text-primary">· new</span>}
                  </span>
                  {!readOnly && !isPrimary && (
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(i)} aria-label="Remove contact">
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                <Field data-invalid={!!e?.name}>
                  <FieldLabel htmlFor={`c${i}-name`}>Name</FieldLabel>
                  <Input id={`c${i}-name`} disabled={readOnly} {...register(`contacts.${i}.name`)} />
                  <FieldError errors={[e?.name]} />
                </Field>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Field data-invalid={!!e?.phone}>
                    <FieldLabel htmlFor={`c${i}-phone`}>Phone</FieldLabel>
                    <div className="flex items-center gap-1">
                      <Input id={`c${i}-phone`} type="tel" inputMode="numeric" disabled={readOnly} {...register(`contacts.${i}.phone`)} />
                      {stored?.phone && <CopyButton value={stored.phone} label="phone" />}
                    </div>
                    <FieldError errors={[e?.phone]} />
                  </Field>
                  <Field className="w-24">
                    <FieldLabel htmlFor={`c${i}-tshirt`}>T-shirt</FieldLabel>
                    <TshirtSelect id={`c${i}-tshirt`} name={`contacts.${i}.tshirtSize`} disabled={readOnly} />
                  </Field>
                </div>
                <Field data-invalid={!!e?.email}>
                  <FieldLabel htmlFor={`c${i}-email`}>Email</FieldLabel>
                  <Input id={`c${i}-email`} type="email" disabled={readOnly} {...register(`contacts.${i}.email`)} />
                  <FieldError errors={[e?.email]} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor={`c${i}-year`}>Year</FieldLabel>
                    <Input id={`c${i}-year`} disabled={readOnly} {...register(`contacts.${i}.year`)} />
                  </Field>
                  <Field data-invalid={!!e?.matiksUsername}>
                    <FieldLabel htmlFor={`c${i}-user`}>Matiks username</FieldLabel>
                    <Input id={`c${i}-user`} autoCapitalize="none" disabled={readOnly} {...register(`contacts.${i}.matiksUsername`)} />
                    <FieldError errors={[e?.matiksUsername]} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`c${i}-address`}>Address</FieldLabel>
                  <Textarea id={`c${i}-address`} rows={2} disabled={readOnly} {...register(`contacts.${i}.address`)} />
                </Field>
                <Field data-invalid={!!e?.pincode} className="w-32">
                  <FieldLabel htmlFor={`c${i}-pin`}>Pincode</FieldLabel>
                  <Input id={`c${i}-pin`} inputMode="numeric" maxLength={6} disabled={readOnly} {...register(`contacts.${i}.pincode`)} />
                  <FieldError errors={[e?.pincode]} />
                </Field>
                {isAdmin && (
                  <Field>
                    <FieldLabel htmlFor={`c${i}-merch`}>Merch owed</FieldLabel>
                    <Textarea
                      id={`c${i}-merch`}
                      rows={2}
                      placeholder="e.g. Matiks hoodie + stickers"
                      disabled={readOnly}
                      {...register(`contacts.${i}.merchDescription`)}
                    />
                  </Field>
                )}
                {stored && (isAdmin || stored.merch_description) && (
                  <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">Merch</span>
                    {isAdmin && !readOnly && (
                      <Switch
                        checked={merchSent(stored.id)}
                        onCheckedChange={(v) => onMerchSent(stored.id, v)}
                        aria-label={`Merch sent to ${stored.name}`}
                      />
                    )}
                    <PillBadge ok={merchSent(stored.id)} labelOk="Sent" labelPending="Pending" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function TshirtSelect({ id, name, disabled }: { id: string; name: `contacts.${number}.tshirtSize` | `winners.${number}.tshirtSize`; disabled?: boolean }) {
  const { control } = useFormContext<EditorFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value ?? undefined} onValueChange={field.onChange} disabled={disabled}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {TSHIRT_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
