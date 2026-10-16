import Link from "next/link";

const LINKS = [
  { href: "/colleges", label: "Colleges" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/college", label: "My college" },
  { href: "/register", label: "Register" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© Matiks</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            // py-1.5 keeps tap targets >= 32px tall on phones.
            <Link key={l.href} href={l.href} className="py-1.5 transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
