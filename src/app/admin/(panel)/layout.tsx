import { Suspense } from "react";

import { CommandPalette } from "@/components/admin/command-palette";
import { AdminAccountMenu } from "@/components/panel/account-menu";
import { NavFallback } from "@/components/panel/nav-fallback";
import { NotificationBell } from "@/components/panel/notification-bell";
import { PanelNav } from "@/components/panel/panel-nav";
import { PanelStickers } from "@/components/stickers";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";

// src/proxy.ts already guards /admin/*; pages and actions re-check with requireAdmin()/requireAdminWriter().
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Decorative, wide screens only; must stay a direct child here so position: fixed isn't trapped. */}
      <PanelStickers panel="admin" />
      <Suspense fallback={<NavFallback />}>
        <AdminNav />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-14">
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>{children}</Suspense>
      </main>
    </div>
  );
}

async function AdminNav() {
  const { profile, isWriter } = await requireAdmin();
  return (
    <>
      <PanelNav
        panel="admin"
        actions={
          <>
            <NotificationBell userId={profile.user_id} />
            <AdminAccountMenu name={profile.name || profile.email.split("@")[0]} email={profile.email} role={profile.role} />
          </>
        }
      />
      <CommandPalette isWriter={isWriter} />
    </>
  );
}
