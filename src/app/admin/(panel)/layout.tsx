import Link from "next/link";
import { Suspense } from "react";

import { AdminMobileNav, AdminSidebarNav, AdminSidebarNavFallback } from "@/components/admin/admin-nav";
import { CommandPalette } from "@/components/admin/command-palette";
import { Logo } from "@/components/league/logo";
import { SeasonPicker } from "@/components/admin/season-picker";
import { UserMenu } from "@/components/admin/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminLeagues, getSelectedLeague } from "@/lib/data/admin-leagues";

// src/proxy.ts already guards /admin/*; pages and actions re-check with requireAdmin()/requireAdminWriter().
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar p-3 md:block">
        <Link href="/admin" className="mb-5 block px-2 py-2">
          <Logo subtitle="Admin console" />
        </Link>
        <Suspense fallback={<AdminSidebarNavFallback />}>
          <AdminSidebarNav />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur sm:px-6">
          <Suspense fallback={<div className="size-9 md:hidden" />}>
            <AdminMobileNav />
          </Suspense>
          <Link href="/admin" className="md:hidden" aria-label="Admin home">
            <Logo compact />
          </Link>
          <Suspense fallback={<Skeleton className="ml-auto h-8 w-64" />}>
            <TopBar />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Skeleton className="h-8 w-48" />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function TopBar() {
  const [{ profile, isWriter }, leagues, selected] = await Promise.all([
    requireAdmin(),
    getAdminLeagues(),
    getSelectedLeague(),
  ]);
  return (
    <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
      <CommandPalette isWriter={isWriter} />
      <SeasonPicker leagues={leagues} selectedId={selected?.id ?? null} />
      <UserMenu profile={profile} />
    </div>
  );
}
