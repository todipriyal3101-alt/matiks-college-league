import { SearchIcon, TrophyIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CountrySwitch } from "@/components/admin/country-switch";
import { UrlSearch } from "@/components/admin/url-search";
import { Glass } from "@/components/glass";
import { ReviewBadge } from "@/components/league/badges";
import { CollegeLogo } from "@/components/league/college-logo";
import { EmptyState } from "@/components/league/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getPeople, matchPeople } from "@/lib/data/people";
import { getAdminCountry, getRegistrations } from "@/lib/data/portal";
import type { ReviewStatus } from "@/lib/league";
import { COUNTRY_LABELS } from "@/lib/validation/portal";

export const metadata: Metadata = { title: "Search" };

const MAX = 50;

/** The global search as a page (also Ctrl/⌘+K anywhere in admin): colleges, POCs and winners by name, phone or email. */
export default function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  return (
    <div className="fade-in space-y-5">
      <Suspense fallback={<Skeleton className="h-14 w-60" />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-11 w-full rounded-full" />}>
        <UrlSearch placeholder="Search colleges, POCs, winners, phones, emails…" />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-3xl" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const [, country] = await Promise.all([requireAdmin(), getAdminCountry()]);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {COUNTRY_LABELS[country]} · all seasons · <kbd className="font-mono">⌘K</kbd> anywhere
        </p>
        <h1 className="text-5xl sm:text-6xl">Search</h1>
      </div>
      <CountrySwitch value={country} />
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/admin/search">, "searchParams">) {
  const [, country, params] = await Promise.all([requireAdmin(), getAdminCountry(), searchParams]);
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  if (q.length < 2) {
    return <EmptyState icon={SearchIcon} title="Type at least 2 letters" description="Find a college, a POC or a winner by name, phone or email." />;
  }

  const needle = q.toLowerCase();
  const [rows, people] = await Promise.all([getRegistrations(country), getPeople(country)]);
  const colleges = rows
    .filter((r) => [r.college_name, r.city, r.state, r.club_name, r.college_email, r.email_domain].some((v) => v?.toLowerCase().includes(needle)))
    .slice(0, MAX);
  const hits = matchPeople(people, q).slice(0, MAX);

  if (!colleges.length && !hits.length) {
    return <EmptyState icon={SearchIcon} title="Nothing found" description={`No college, POC or winner in ${COUNTRY_LABELS[country]} matches “${q}”.`} />;
  }

  return (
    <div className="space-y-5">
      {colleges.length > 0 && (
        <Glass className="p-2 sm:p-3">
          <h2 className="px-2 pt-1 pb-2 font-sans text-xs font-bold tracking-[0.12em] text-lilac normal-case">Colleges · {colleges.length}</h2>
          <ul className="space-y-1.5">
            {colleges.map((r) => (
              <li key={r.registration_id}>
                <Link href={`/admin/colleges/${r.registration_id}`} className="glass-surface flex items-center gap-3 rounded-2xl p-3 hover:bg-white/9">
                  <CollegeLogo url={r.college_logo_url} name={r.college_name ?? "?"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.college_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.league_name, r.city, r.primary_poc_name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ReviewBadge status={r.review_status as ReviewStatus} />
                </Link>
              </li>
            ))}
          </ul>
        </Glass>
      )}
      {hits.length > 0 && (
        <Glass className="p-2 sm:p-3">
          <h2 className="px-2 pt-1 pb-2 font-sans text-xs font-bold tracking-[0.12em] text-lilac normal-case">POCs &amp; winners · {hits.length}</h2>
          <ul className="space-y-1.5">
            {hits.map((p, i) => (
              <li key={`${p.kind}-${p.registrationId}-${i}`}>
                <Link
                  href={`/admin/colleges/${p.registrationId}?tab=${p.kind === "winner" ? "winners" : "contacts"}`}
                  className="glass-surface flex items-center gap-3 rounded-2xl p-3 hover:bg-white/9"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-olive text-primary">
                    {p.kind === "winner" ? <TrophyIcon className="size-5" /> : <UserIcon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name || p.phone || p.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.detail} · {p.college}
                    </span>
                  </span>
                  <span className="hidden min-w-0 text-right text-xs text-muted-foreground sm:block">
                    {p.phone && <span className="block font-mono">{p.phone}</span>}
                    {p.email && <span className="block truncate">{p.email}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Glass>
      )}
    </div>
  );
}
