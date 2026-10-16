import { BuildingIcon, CalendarPlusIcon, ClipboardCheckIcon, IndianRupeeIcon, RadioIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddCollegeDialog } from "@/components/admin/overview/add-college-dialog";
import { InsightsView } from "@/components/admin/insights/insights-view";
import { ExportMenu } from "@/components/admin/overview/export-menu";
import { OverviewFilters } from "@/components/admin/overview/overview-filters";
import { OverviewTable } from "@/components/admin/overview/overview-table";
import { EmptyState } from "@/components/league/empty-state";
import { StatCard } from "@/components/league/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { filterOverview, getOverview, overviewSources, overviewStats } from "@/lib/data/league-ops";
import { getSeasonPeople, matchPeople } from "@/lib/data/people";
import { formatINR } from "@/lib/league";
import { createClient } from "@/lib/supabase/server";
import { parseOverviewFilters } from "@/lib/validation/league-ops";

export const metadata: Metadata = { title: "League Overview" };

export default function LeagueOverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const [{ isWriter }, league, params] = await Promise.all([requireAdmin(), getSelectedLeague(), searchParams]);

  if (!league) {
    return (
      <EmptyState
        icon={CalendarPlusIcon}
        title="No seasons yet"
        description="Create the first season to start taking registrations."
        action={
          <Button asChild>
            <Link href="/admin/leagues">Go to Seasons</Link>
          </Button>
        }
      />
    );
  }

  const supabase = await createClient();
  const [rows, emails] = await Promise.all([
    getOverview(league.id),
    // Not in registration_overview: only needed for the "Invite POC" default.
    supabase.from("registrations").select("id, poc_email").eq("league_id", league.id),
  ]);
  const pocEmails = Object.fromEntries((emails.data ?? []).map((r) => [r.id, r.poc_email]));
  const filters = parseOverviewFilters(params);
  const insights = params.tab === "insights";
  const stats = overviewStats(rows);
  // The search box also finds winners and contacts by name or phone; the row then says who matched.
  const people = filters.q ? matchPeople(await getSeasonPeople(league.id), filters.q) : [];
  const matches: Record<string, string[]> = {};
  for (const p of people) (matches[p.registrationId] ??= []).push(`${p.name || p.phone} (${p.detail})`);
  const visible = filterOverview(rows, filters, new Set(Object.keys(matches)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{league.name}</p>
          <h1 className="text-5xl">Overview</h1>
        </div>
        {isWriter && (
          <div className="flex gap-2">
            {rows.length > 0 && <ExportMenu />}
            <AddCollegeDialog leagueId={league.id} leagueName={league.name} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard icon={BuildingIcon} label="Colleges" value={stats.colleges} hint={`${stats.approved} approved`} />
        <StatCard icon={IndianRupeeIcon} label="Prize committed" value={formatINR(stats.prizeCommitted)} hint="approved colleges" />
        <StatCard icon={TrophyIcon} label="Prize paid out" value={formatINR(stats.prizePaid)} />
        <StatCard icon={RadioIcon} label="Live now" value={stats.liveNow} />
        <StatCard
          icon={ClipboardCheckIcon}
          label="Pending review"
          value={stats.pendingReview}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <nav className="flex gap-1 border-b border-border/60" aria-label="Overview sections">
        <TabLink href="/admin" active={!insights}>
          Colleges
        </TabLink>
        <TabLink href="/admin?tab=insights" active={insights}>
          Insights
        </TabLink>
      </nav>

      {insights ? (
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <InsightsView leagueId={league.id} />
        </Suspense>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="No colleges yet"
          description={isWriter ? "Share /register or add a college." : "Colleges show up as they register."}
          action={isWriter ? <AddCollegeDialog leagueId={league.id} leagueName={league.name} /> : undefined}
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <QuickFilter href="/admin" active={filters.review === "all"} label="All" count={rows.length} />
            <QuickFilter href="/admin?review=pending" active={filters.review === "pending"} label="Pending review" count={stats.pendingReview} highlight />
            <QuickFilter href="/admin?review=approved" active={filters.review === "approved"} label="Approved" count={stats.approved} />
          </div>
          <OverviewFilters filters={filters} sources={overviewSources(rows)} />
          <p className="text-xs text-muted-foreground">
            {visible.length} of {rows.length}
          </p>
          <OverviewTable rows={visible} isWriter={isWriter} pocEmails={pocEmails} matches={matches} />
        </section>
      )}
    </div>
  );
}

/** One-tap review filters (the most used is Pending review). */
function QuickFilter({ href, active, label, count, highlight }: { href: string; active: boolean; label: string; count: number; highlight?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted"}`}
    >
      {label}
      <span className={`font-mono text-xs ${active ? "" : highlight && count ? "text-status-pending-fg" : "text-muted-foreground"}`}>{count}</span>
    </Link>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </Link>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
