import Link from "next/link";
import { Suspense } from "react";

import { AdminMobileNav, AdminSidebarNav } from "@/components/admin/admin-nav";
import { SeasonPicker } from "@/components/admin/season-picker";
import { UserMenu } from "@/components/admin/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminLeagues, getSelectedLeague } from "@/lib/data/admin-leagues";

// src/proxy.ts already guards /admin/*; pages and actions re-check with requireAdmin()/requireAdminWriter().
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r p-3 md:block">
        <Link href="/admin" className="mb-4 block px-3 py-2 font-semibold tracking-tight">
          League Admin
        </Link>
        <AdminSidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <AdminMobileNav />
          <Suspense fallback={<Skeleton className="ml-auto h-8 w-64" />}>
            <TopBar />
          </Suspense>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Suspense fallback={<Skeleton className="h-8 w-48" />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function TopBar() {
  const [{ profile }, leagues, selected] = await Promise.all([
    requireAdmin(),
    getAdminLeagues(),
    getSelectedLeague(),
  ]);
  return (
    <div className="ml-auto flex items-center gap-2">
      <SeasonPicker leagues={leagues} selectedId={selected?.id ?? null} />
      <UserMenu profile={profile} />
    </div>
  );
}
