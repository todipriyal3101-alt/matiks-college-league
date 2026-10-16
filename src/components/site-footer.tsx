import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© Matiks · Matiks College League</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/colleges" className="hover:text-foreground">
            Colleges
          </Link>
          <Link href="/fixtures" className="hover:text-foreground">
            Fixtures
          </Link>
          <Link href="/college" className="hover:text-foreground">
            My college
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Register
          </Link>
        </nav>
      </div>
    </footer>
  );
}
