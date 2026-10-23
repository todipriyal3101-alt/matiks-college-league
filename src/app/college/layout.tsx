import { Suspense } from "react";

import { NavFallback } from "@/components/panel/nav-fallback";
import { NotificationBell } from "@/components/panel/notification-bell";
import { PocAccountMenu } from "@/components/panel/account-menu";
import { PanelNav } from "@/components/panel/panel-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getPocContext } from "@/lib/data/poc";

/** POC panel: Register · Chat · Winners, the bell and the account menu. Phone-first (CLAUDE.md rule 6). */
export default function CollegeLayout({ children }: LayoutProps<"/college">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<NavFallback />}>
        <PocNav />
      </Suspense>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-14">
        <Suspense fallback={<Skeleton className="h-10 w-56" />}>{children}</Suspense>
      </main>
    </div>
  );
}

async function PocNav() {
  // src/proxy.ts already requires a login for /college.
  const ctx = await getPocContext();
  if (!ctx) return <NavFallback />;
  return (
    <PanelNav
      panel="poc"
      actions={
        <>
          <NotificationBell userId={ctx.userId} />
          <PocAccountMenu name={ctx.name || ctx.email.split("@")[0]} email={ctx.email} />
        </>
      }
    />
  );
}
