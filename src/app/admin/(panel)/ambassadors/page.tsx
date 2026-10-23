import type { Metadata } from "next";
import { Suspense } from "react";

import { SeasonBar } from "@/components/admin/season-bar";
import { AmbassadorsList } from "@/components/admin/ambassadors/ambassadors-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ambassadors" };

export default function AmbassadorsPage() {
  return (
    <div className="fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl sm:text-6xl">Ambassadors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Referral links, QR codes and signups.</p>
        </div>
        <SeasonBar />
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Ambassadors />
      </Suspense>
    </div>
  );
}

async function Ambassadors() {
  const [{ isWriter }, league] = await Promise.all([requireAdmin(), getSelectedLeague()]);
  const supabase = await createClient();
  const [ambassadors, regs] = await Promise.all([
    supabase.from("ambassadors").select("id, name, email, phone, referral_code, active, colleges(id, name)").order("name"),
    supabase.from("registrations").select("league_id, referral_code").not("referral_code", "is", null),
  ]);

  // Codes arrive from URLs as typed, so match case-insensitively.
  const total = new Map<string, number>();
  const season = new Map<string, number>();
  for (const r of regs.data ?? []) {
    const code = r.referral_code!.toUpperCase();
    total.set(code, (total.get(code) ?? 0) + 1);
    if (r.league_id === league?.id) season.set(code, (season.get(code) ?? 0) + 1);
  }

  const rows = (ambassadors.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    college: a.colleges ? { id: a.colleges.id, name: a.colleges.name } : null,
    code: a.referral_code,
    active: a.active,
    signupsSeason: season.get(a.referral_code.toUpperCase()) ?? 0,
    signupsTotal: total.get(a.referral_code.toUpperCase()) ?? 0,
  }));
  rows.sort((a, b) => b.signupsSeason - a.signupsSeason || a.name.localeCompare(b.name));

  return (
    <AmbassadorsList
      ambassadors={rows}
      siteUrl={siteUrl}
      seasonName={league?.name ?? "this season"}
      isWriter={isWriter}
    />
  );
}
