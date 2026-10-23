"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setAdminCountry } from "@/app/admin/(panel)/actions";
import { SegmentedControl } from "@/components/segmented-control";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_LABELS, type Country } from "@/lib/validation/portal";

const OPTIONS = COUNTRIES.map((c) => ({
  value: c,
  label: (
    <>
      <span aria-hidden>{COUNTRY_FLAGS[c]}</span> {COUNTRY_LABELS[c]}
    </>
  ),
}));

/** India / USA: filters every number and list in admin; remembered in a cookie. */
export function CountrySwitch({ value }: { value: Country }) {
  const [pending, startTransition] = useTransition();
  return (
    <SegmentedControl
      label="Country"
      options={OPTIONS}
      value={value}
      disabled={pending}
      onChange={(c) =>
        c !== value &&
        startTransition(async () => {
          try {
            await setAdminCountry(c);
          } catch {
            toast.error("Couldn't switch country.");
          }
        })
      }
    />
  );
}
