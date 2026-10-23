import { ArrowLeftIcon, BuildingIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CollegesList } from "@/components/admin/colleges/colleges-list";
import { CountrySwitch } from "@/components/admin/country-switch";
import { UrlSearch } from "@/components/admin/url-search";
import { Glass } from "@/components/glass";
import { EmptyState } from "@/components/league/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import type { OverviewRow } from "@/lib/data/league-ops";
import { getAdminCountry, getRegistrations } from "@/lib/data/portal";
import { cn } from "@/lib/utils";
import { COUNTRY_LABELS } from "@/lib/validation/portal";

export const metadata: Metadata = { title: "Registered colleges" };

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const inTab = (r: OverviewRow, tab: Tab) =>
  tab === "all" ||
  (tab === "pending" && r.review_status === "pending") ||
  (tab === "approved" && r.review_status === "approved") ||
  (tab === "denied" && r.review_status === "rejected");

function matches(r: OverviewRow, q: string) {
  if (!q) return true;
  return [r.college_name, r.city, r.state, r.primary_poc_name, r.poc_email, r.primary_poc_phone, r.club_name, r.utm_source, r.referral_code, r.league_name]
    .some((v) => v?.toLowerCase().includes(q));
}

export default function CollegesPage({ searchParams }: PageProps<"/admin/colleges">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Colleges searchParams={searchParams} />
    </Suspense>
  );
}

async function Colleges({ searchParams }: Pick<PageProps<"/admin/colleges">, "searchParams">) {
  const [{ isWriter }, country, params] = await Promise.all([requireAdmin(), getAdminCountry(), searchParams]);
  const tab: Tab = TABS.some((t) => t.key === params.status) ? (params.status as Tab) : "all";
  const q = (typeof params.q === "string" ? params.q : "").trim().toLowerCase().slice(0, 100);
  const rows = await getRegistrations(country);
  const searched = rows.filter((r) => matches(r, q));
  const visible = searched.filter((r) => inTab(r, tab));

  return (
    <div className="fade-in space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/85 hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Overview
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{COUNTRY_LABELS[country]} · all seasons</p>
          <h1 className="text-5xl sm:text-6xl">Registered colleges</h1>
        </div>
        <CountrySwitch value={country} />
      </div>

      <Glass className="space-y-3 p-2 sm:p-3">
        <div className="flex flex-col gap-3 p-1 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Review status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {TABS.map((t) => {
              const n = searched.filter((r) => inTab(r, t.key)).length;
              const active = t.key === tab;
              const qs = new URLSearchParams({ ...(t.key !== "all" && { status: t.key }), ...(q && { q }) }).toString();
              return (
                <Link
                  key={t.key}
                  href={`/admin/colleges${qs ? `?${qs}` : ""}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors",
                    active ? "bg-foreground text-background" : "bg-white/6 text-foreground/85 hover:bg-white/10",
                  )}
                >
                  {t.label}
                  <span className={cn("font-mono text-xs", !active && t.key === "pending" && n > 0 && "text-status-pending-fg")}>{n}</span>
                </Link>
              );
            })}
          </nav>
          <UrlSearch placeholder="Search college, POC, phone, source…" className="sm:w-80" />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={BuildingIcon}
            title={rows.length === 0 ? "No colleges yet" : "Nothing here"}
            description={
              rows.length === 0
                ? `Colleges in ${COUNTRY_LABELS[country]} show up as POCs register. Share the POC sign-up link, or use Add college on the Overview.`
                : "Try another tab or clear the search."
            }
          />
        ) : (
          <CollegesList rows={visible} isWriter={isWriter} />
        )}
      </Glass>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-14 w-80" />
      <Skeleton className="h-[28rem] w-full rounded-3xl" />
    </div>
  );
}
