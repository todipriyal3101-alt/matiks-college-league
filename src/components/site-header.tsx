import Link from "next/link";

import { Glass } from "@/components/glass";
import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";

/** Header for the remaining public pages (/colleges, /fixtures: still live, no longer linked). */
export function SiteHeader() {
  return (
    <header className="sticky top-3 z-40 px-4">
      <Glass variant="pill" refract className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 pr-2 pl-5">
        <Link href="/" aria-label="Matiks College League home">
          <Logo />
        </Link>
        <Button asChild className="h-10 rounded-full px-5">
          <Link href="/login">Sign in</Link>
        </Button>
      </Glass>
    </header>
  );
}
