import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Matiks College League
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/colleges"
            className="hidden px-3 py-2 text-muted-foreground hover:text-foreground sm:inline"
          >
            Colleges
          </Link>
          <Link
            href="/my"
            className="px-3 py-2 text-muted-foreground hover:text-foreground"
          >
            My registration
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Register</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
