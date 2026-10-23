import { Suspense } from "react";

import { SeasonPicker } from "@/components/admin/season-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminLeagues, getSelectedLeague } from "@/lib/data/admin-leagues";

/** Season picker for the per-season tools (Matches, Ambassadors, Manage Admins). Seasons stay out of the main nav. */
export function SeasonBar() {
  return (
    <Suspense fallback={<Skeleton className="h-9 w-56 rounded-xl" />}>
      <Picker />
    </Suspense>
  );
}

async function Picker() {
  const [leagues, selected] = await Promise.all([getAdminLeagues(), getSelectedLeague()]);
  return <SeasonPicker leagues={leagues} selectedId={selected?.id ?? null} />;
}
