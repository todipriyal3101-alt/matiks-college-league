import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CountrySwitch } from "@/components/admin/country-switch";
import { NotifyDialog } from "@/components/admin/pocs/notify-dialog";
import { PocsList } from "@/components/admin/pocs/pocs-list";
import { Glass } from "@/components/glass";
import { EmptyState } from "@/components/league/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminCountry, getPocs, getRegistrations } from "@/lib/data/portal";
import { COUNTRY_LABELS } from "@/lib/validation/portal";

export const metadata: Metadata = { title: "POCs" };

export default function PocsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <Pocs />
    </Suspense>
  );
}

async function Pocs() {
  const [{ isWriter }, country] = await Promise.all([requireAdmin(), getAdminCountry()]);
  const [pocs, registrations] = await Promise.all([getPocs(country), getRegistrations(country)]);
  const colleges = registrations
    .filter((r) => r.review_status !== "rejected")
    .map((r) => ({ id: r.registration_id!, name: `${r.college_name} · ${r.league_name}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{COUNTRY_LABELS[country]} · all seasons</p>
          <h1 className="text-5xl sm:text-6xl">POCs</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CountrySwitch value={country} />
          {isWriter && <NotifyDialog country={country} colleges={colleges} />}
        </div>
      </div>
      <Glass className="p-2 sm:p-3">
        {pocs.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No POCs yet" description={`POCs show up here when colleges in ${COUNTRY_LABELS[country]} register.`} />
        ) : (
          <PocsList rows={pocs} />
        )}
      </Glass>
    </div>
  );
}
