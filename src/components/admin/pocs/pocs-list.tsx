"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ReviewBadge } from "@/components/league/badges";
import { Input } from "@/components/ui/input";
import type { PocRow } from "@/lib/data/portal";
import type { ReviewStatus } from "@/lib/league";

/** Every POC of the selected country with a quick filter (name, college, phone, email). Plain rows: no blur. */
export function PocsList({ rows }: { rows: PocRow[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const visible = needle
    ? rows.filter(
        (r) =>
          [r.name, r.college, r.email].some((v) => v.toLowerCase().includes(needle)) ||
          (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)),
      )
    : rows;

  return (
    <div className="space-y-3">
      <div className="relative sm:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, college, phone, email" aria-label="Search POCs" className="h-11 rounded-full pl-10" />
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        {visible.length} of {rows.length}
      </p>
      <ul className="space-y-1.5">
        {visible.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/colleges/${r.registrationId}?tab=contacts`}
              className="glass-surface grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-2xl p-3 hover:bg-white/9 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{r.name}</span>
                <span className="block text-xs text-muted-foreground">{r.isPrimary ? "Primary POC" : "POC"}</span>
              </span>
              <span className="min-w-0 truncate text-sm max-md:col-span-2 max-md:row-start-2">{r.college}</span>
              <span className="truncate font-mono text-sm max-md:col-span-2 max-md:row-start-3">{r.phone ?? "—"}</span>
              <span className="truncate text-sm text-muted-foreground max-md:col-span-2 max-md:row-start-4">{r.email}</span>
              <span className="max-md:col-start-2 max-md:row-start-1">
                <ReviewBadge status={r.reviewStatus as ReviewStatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
