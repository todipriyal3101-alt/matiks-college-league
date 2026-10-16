import Link from "next/link";

import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Matiks College League home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/colleges"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground sm:inline"
          >
            Colleges
          </Link>
          <Link
            href="/college"
            className="hidden rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground sm:inline"
          >
            My college
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Register</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
