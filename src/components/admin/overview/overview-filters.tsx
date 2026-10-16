"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REVIEW_LABELS, REVIEW_STATUSES, STAGE_LABELS, STAGES } from "@/lib/league";
import type { OverviewFilters as Filters } from "@/lib/validation/league-ops";

const DEFAULTS: Filters = { q: "", review: "all", stage: "all", source: "all", sort: "college" };
const SORT_LABELS: Record<Filters["sort"], string> = {
  college: "College A–Z",
  participants: "Most participants",
  prize: "Biggest prize pool",
  newest: "Newest first",
};

/** Search + filters, kept in the URL so views can be shared and survive reloads. */
export function OverviewFilters({ filters, sources }: { filters: Filters; sources: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);

  function update(patch: Partial<Filters>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === DEFAULTS[key as keyof Filters] || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce typing into the URL.
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the typed text changes
  }, [q]);

  const active = filters.q || filters.review !== "all" || filters.stage !== "all" || filters.source !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search college, POC, winner, phone…"
          className="h-9 pl-9"
          aria-label="Search colleges, contacts and winners"
        />
        {pending && (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <FilterSelect
        label="Review"
        value={filters.review}
        onChange={(v) => update({ review: v as Filters["review"] })}
        options={[["all", "All reviews"], ...REVIEW_STATUSES.map((s) => [s, REVIEW_LABELS[s]] as [string, string])]}
      />
      <FilterSelect
        label="Stage"
        value={filters.stage}
        onChange={(v) => update({ stage: v as Filters["stage"] })}
        options={[["all", "All stages"], ...STAGES.map((s) => [s, STAGE_LABELS[s]] as [string, string])]}
      />
      <FilterSelect
        label="Source"
        value={filters.source}
        onChange={(v) => update({ source: v })}
        options={[["all", "All sources"], ...sources.map((s) => [s, s] as [string, string])]}
      />
      <FilterSelect
        label="Sort"
        value={filters.sort}
        onChange={(v) => update({ sort: v as Filters["sort"] })}
        options={Object.entries(SORT_LABELS)}
      />
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            update({ q: "", review: "all", stage: "all", source: "all" });
          }}
        >
          <XIcon /> Clear
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
