"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TSHIRT_SIZES, YEARS, type ContactFields } from "@/lib/validation/portal";

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

/** One contact's fields (Register form + Team contacts). Required: name, phone, email, year, Matiks username. */
export function ContactFieldsForm({
  value,
  onChange,
  errors = {},
  idPrefix,
  disabled,
}: {
  value: ContactFields;
  onChange: (next: ContactFields) => void;
  errors?: ContactErrors;
  idPrefix: string;
  disabled?: boolean;
}) {
  const id = (k: keyof ContactFields) => `${idPrefix}-${k}`;
  const set = <K extends keyof ContactFields>(k: K, v: ContactFields[K]) => onChange({ ...value, [k]: v });
  const text = (k: "name" | "phone" | "email" | "matiksUsername" | "pincode") => ({
    id: id(k),
    value: value[k],
    disabled,
    "aria-invalid": !!errors[k] || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    className: "h-12",
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
        <Input autoComplete="name" {...text("name")} />
        <FieldError>{errors.name}</FieldError>
      </Field>
      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor={id("phone")}>Phone (WhatsApp)</FieldLabel>
        <Input type="tel" inputMode="tel" autoComplete="tel" {...text("phone")} className="h-12 font-mono" />
        <FieldError>{errors.phone}</FieldError>
      </Field>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor={id("email")}>Email</FieldLabel>
        <Input type="email" inputMode="email" autoComplete="email" {...text("email")} />
        <FieldError>{errors.email}</FieldError>
      </Field>
      <Field data-invalid={!!errors.year}>
        <FieldLabel htmlFor={id("year")}>Year</FieldLabel>
        <Select value={value.year || undefined} onValueChange={(v) => set("year", v)} disabled={disabled}>
          <SelectTrigger id={id("year")} className="w-full data-[size=default]:h-12" aria-invalid={!!errors.year || undefined}>
            <SelectValue placeholder="Pick a year" />
          </SelectTrigger>
          <SelectContent>
            {/* Keep an older free-text value selectable. */}
            {[...(value.year && !(YEARS as readonly string[]).includes(value.year) ? [value.year] : []), ...YEARS].map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{errors.year}</FieldError>
      </Field>
      <Field data-invalid={!!errors.matiksUsername}>
        <FieldLabel htmlFor={id("matiksUsername")}>Matiks username</FieldLabel>
        <Input autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="As in the Matiks app" {...text("matiksUsername")} />
        <FieldError>{errors.matiksUsername}</FieldError>
      </Field>
      <Field data-invalid={!!errors.tshirtSize}>
        <FieldLabel htmlFor={id("tshirtSize")}>
          T-shirt size <span className="font-normal text-muted-foreground">(for merch)</span>
        </FieldLabel>
        <Select value={value.tshirtSize ?? undefined} onValueChange={(v) => set("tshirtSize", v as ContactFields["tshirtSize"])} disabled={disabled}>
          <SelectTrigger id={id("tshirtSize")} className="w-full data-[size=default]:h-12">
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
      </Field>
      <Field data-invalid={!!errors.address} className="sm:col-span-2">
        <FieldLabel htmlFor={id("address")}>
          Address <span className="font-normal text-muted-foreground">(where we ship merch)</span>
        </FieldLabel>
        <Textarea
          id={id("address")}
          rows={2}
          value={value.address}
          disabled={disabled}
          maxLength={300}
          autoComplete="street-address"
          onChange={(e) => set("address", e.target.value)}
          aria-invalid={!!errors.address || undefined}
        />
        <FieldError>{errors.address}</FieldError>
      </Field>
      <Field data-invalid={!!errors.pincode}>
        <FieldLabel htmlFor={id("pincode")}>Pincode</FieldLabel>
        <Input inputMode="numeric" autoComplete="postal-code" maxLength={10} {...text("pincode")} className="h-12 font-mono" />
        <FieldError>{errors.pincode}</FieldError>
      </Field>
    </div>
  );
}

/** zod issues → per-field messages for one contact (path [..., i, field] → field). */
export function contactErrors(issues: readonly { path: PropertyKey[]; message: string }[], prefix: PropertyKey[]): ContactErrors {
  const out: ContactErrors = {};
  for (const issue of issues) {
    if (prefix.some((p, i) => issue.path[i] !== p)) continue;
    const key = issue.path[prefix.length] as keyof ContactFields;
    out[key] ??= issue.message;
  }
  return out;
}
