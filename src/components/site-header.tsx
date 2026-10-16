import Link from "next/link";

import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/colleges", label: "Colleges" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/college", label: "My college" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Matiks College League home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              {n.label}
            </Link>
          ))}
          <Button asChild className="ml-1 h-10 px-4 uppercase">
            <Link href="/register">Register</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
