import {
  ArrowRightIcon,
  BuildingIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  HourglassIcon,
  IndianRupeeIcon,
  RadioIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CountrySwitch } from "@/components/admin/country-switch";
import { AddCollegeDialog } from "@/components/admin/overview/add-college-dialog";
import { ExportAllButton } from "@/components/admin/overview/export-button";
import { MatiksBanner } from "@/components/admin/overview/matiks-banner";
import { Glass } from "@/components/glass";
import { StatCard } from "@/components/league/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { getAdminCountry, getRegistrations, overviewTotals } from "@/lib/data/portal";
import { formatMoney } from "@/lib/league";
import { COUNTRY_LABELS } from "@/lib/validation/portal";

export const metadata: Metadata = { title: "Overview" };

const pad = (n: number) => String(n).padStart(3, "0");
const count = new Intl.NumberFormat("en-IN");

/** Summary only (the list lives at /admin/colleges). Every number follows the India / USA switch. */
export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const [{ isWriter }, country, league] = await Promise.all([requireAdmin(), getAdminCountry(), getSelectedLeague()]);
  const t = overviewTotals(await getRegistrations(country));

  return (
    <div className="fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Matiks College League · {COUNTRY_LABELS[country]}
          </p>
          <h1 className="text-5xl sm:text-6xl">Overview</h1>
        </div>
        <CountrySwitch value={country} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={BuildingIcon} label="Total colleges" value={pad(t.colleges)} hint={`${t.approved} approved`} />
        <StatCard icon={RadioIcon} label="Leagues live" value={pad(t.live)} hint="running now" />
        <StatCard icon={CheckCircle2Icon} label="Leagues ended" value={pad(t.ended)} hint={`${t.complete} complete`} />
        <StatCard
          icon={country === "usa" ? CircleDollarSignIcon : IndianRupeeIcon}
          label="Amount burnt"
          value={formatMoney(t.amountBurnt, country)}
          hint="prize money paid out"
        />
        <StatCard icon={UsersIcon} label="Users gained" value={count.format(t.usersGained)} hint="sum of participants" />
        <StatCard icon={HourglassIcon} label="Prize pending" value={pad(t.prizePending)} hint="league done, not paid" />
        <Glass asChild className="col-span-2 bg-primary/10 shadow-[inset_0_0_0_1px_rgb(177_250_99/0.28),var(--glass-edge),var(--glass-drop)]">
          <Link
            href={t.pending ? "/admin/colleges?status=pending" : "/admin/colleges"}
            className="group flex min-h-30 flex-col p-4 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-foreground uppercase">All registered colleges</span>
              <span className="grid size-7 place-items-center rounded-lg bg-olive text-primary transition-transform group-hover:translate-x-0.5">
                <ArrowRightIcon className="size-4" aria-hidden />
              </span>
            </span>
            <span className="mt-auto pt-2 font-display text-4xl leading-none text-primary">
              {t.registered} {t.registered === 1 ? "college" : "colleges"}
            </span>
            <span className="mt-2 flex items-center gap-2 text-xs text-foreground/85">
              {t.pending > 0 ? (
                <span className="rounded-full bg-status-pending px-2.5 py-0.5 font-bold text-status-pending-fg">{t.pending} pending</span>
              ) : (
                <span className="rounded-full bg-status-done px-2.5 py-0.5 font-semibold text-status-done-fg">Nothing to review</span>
              )}
              {t.pending > 0 ? "Review and approve →" : "Open the list →"}
            </span>
          </Link>
        </Glass>
      </div>

      <div className="flex flex-wrap gap-3 max-sm:[&>*]:flex-1">
        {isWriter &&
          (league ? (
            <AddCollegeDialog leagueId={league.id} leagueName={league.name} defaultCountry={country} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a season under <Link href="/admin/leagues" className="font-semibold text-primary">League tools › Seasons</Link> to add colleges.
            </p>
          ))}
        <ExportAllButton isWriter={isWriter} />
      </div>

      <MatiksBanner />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="flex items-end justify-between">
        <Skeleton className="h-14 w-60" />
        <Skeleton className="h-11 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-30 rounded-3xl" />
        ))}
        <Skeleton className="col-span-2 h-30 rounded-3xl" />
      </div>
      <Skeleton className="h-11 w-72 rounded-full" />
      <Skeleton className="h-32 rounded-[2rem] sm:h-48" />
    </div>
  );
}
