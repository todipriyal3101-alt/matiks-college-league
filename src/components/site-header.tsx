import Link from "next/link";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const LINKS = [
  { href: "/#duel", label: "Duel" },
  { href: "/#race", label: "Race" },
  { href: "/#prizes", label: "Prizes" },
  { href: "/#faq", label: "FAQ" },
];

/** Public pages' floating glass nav. Signed in: "Go to dashboard"; otherwise Sign in + Register. */
export function SiteHeader() {
  return (
    <header className="sticky top-3 z-40 px-4">
      <Glass asChild variant="pill" refract>
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-3 pr-2 pl-5">
          <Link href="/" aria-label="Matiks College League home" className="mr-auto shrink-0">
            <Logo />
          </Link>
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-full px-3 py-2 text-sm font-semibold text-foreground/80 hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Suspense fallback={<Cta signedIn={false} />}>
            <AuthCta />
          </Suspense>
        </nav>
      </Glass>
    </header>
  );
}

async function AuthCta() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <Cta signedIn={!!data?.claims.sub} />;
}

function Cta({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <Button asChild className="h-10 rounded-full px-5">
        <Link href="/auth/continue">
          <span className="sm:hidden">Dashboard</span>
          <span className="hidden sm:inline">Go to dashboard</span>
        </Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="ghost" className="hidden h-10 rounded-full px-4 sm:inline-flex">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild className="h-10 rounded-full px-5">
        <Link href="/login?mode=signup">Register</Link>
      </Button>
    </div>
  );
}
