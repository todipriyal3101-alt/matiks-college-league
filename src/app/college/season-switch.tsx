"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Shown only when the POC manages more than one registration (e.g. several seasons). */
export function SeasonSwitch({
  options,
  selectedId,
}: {
  options: { id: string; label: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select value={selectedId} disabled={pending} onValueChange={(id) => startTransition(() => router.push(`/college?r=${id}`))}>
      <SelectTrigger className="h-10 w-full sm:w-72" aria-label="Season">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
