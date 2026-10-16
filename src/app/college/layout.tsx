import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

/** POC portal shell (Lovable "College portal"): phone-first, just the college and sign out. */
export default function CollegeLayout({ children }: LayoutProps<"/college">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/college" aria-label="Your college">
            <Logo subtitle="College portal" />
          </Link>
          <div className="flex items-center gap-2">
            <Suspense>
              <Email />
            </Suspense>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOutIcon /> <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

async function Email() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:inline">{data?.claims.email}</span>;
}
