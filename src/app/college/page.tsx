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
        title="No college linked to your account yet"
        description={`${data?.claims.email ?? "This email"} isn't a POC for any college. Sign in with the email your college registered with, or ask a Matiks admin to invite you.`}
        action={
          <Button asChild variant="outline">
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
    return <EmptyState icon={BuildingIcon} title="College not found" description="It may have been removed. Pick another season above." />;
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  // Only used to label admins as "Matiks team" in the timeline; emails never reach the page.
  const { data: admins } = await createAdminClient().from("admin_profiles").select("email");
  const adminNames = Object.fromEntries((admins ?? []).map((a) => [a.email.toLowerCase(), "Matiks team"]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Your college</p>
          <p className="text-sm text-muted-foreground">Keep your contacts and winners up to date. Matiks handles stages and payouts.</p>
        </div>
        {mine.length > 1 && (
          <SeasonSwitch
            selectedId={selected.id}
            options={mine.map((m) => ({ id: m.id, label: `${m.leagues.name} · ${m.colleges.name}` }))}
          />
        )}
      </div>
      <CollegeEditor detail={detail} mode="poc" me={claims?.claims.email ?? null} adminNames={adminNames} />
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
