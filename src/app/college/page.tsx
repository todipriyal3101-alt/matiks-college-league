import { BuildingIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CollegeEditor } from "@/components/league/college-editor/college-editor";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyRegistrations, getRegistrationDetail } from "@/lib/data/league-ops";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { SeasonSwitch } from "./season-switch";

export const metadata: Metadata = { title: "Your college" };

export default function CollegePortalPage({ searchParams }: PageProps<"/college">) {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <Portal searchParams={searchParams} />
    </Suspense>
  );
}

async function Portal({ searchParams }: Pick<PageProps<"/college">, "searchParams">) {
  const [{ r }, mine] = await Promise.all([searchParams, getMyRegistrations()]);

  if (mine.length === 0) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return (
      <EmptyState
        icon={BuildingIcon}
        title="No college yet"
        description={`${data?.claims.email ?? "This email"} isn't linked to a college. You'll get an email invite once your college is approved.`}
        action={
          <Button asChild variant="outline" className="h-11">
            <Link href="/register">Register your college</Link>
          </Button>
        }
      />
    );
  }

  // Default: the newest season (getMyRegistrations sorts newest first); ?r= picks another.
  const selected = mine.find((m) => m.id === r) ?? mine[0];
  const detail = await getRegistrationDetail(selected.id);
  if (!detail) {
    return <EmptyState icon={BuildingIcon} title="College not found" description="It may have been removed." />;
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  // Only used to label admins as "Matiks team" in the timeline; emails never reach the page.
  const { data: admins } = await createAdminClient().from("admin_profiles").select("email");
  const adminNames = Object.fromEntries((admins ?? []).map((a) => [a.email.toLowerCase(), "Matiks team"]));

  return (
    <div className="space-y-4">
      {mine.length > 1 && (
        <SeasonSwitch
          selectedId={selected.id}
          options={mine.map((m) => ({ id: m.id, label: `${m.leagues.name} · ${m.colleges.name}` }))}
        />
      )}
      <CollegeEditor detail={detail} mode="poc" me={claims?.claims.email ?? null} adminNames={adminNames} />
    </div>
  );
}

/** Same shape as the portal (title, checklist, tabs, panel) so nothing jumps when it loads. */
function PortalSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
