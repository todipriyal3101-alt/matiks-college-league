import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6">
      <span>© Matiks · Matiks College League</span>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/duel" className="py-1.5 hover:text-foreground">30-sec duel</Link>
        <Link href="/login?mode=signup" className="py-1.5 hover:text-foreground">Register your college</Link>
        <a href={process.env.NEXT_PUBLIC_MATIKS_APP_URL || "https://www.matiks.com"} className="py-1.5 hover:text-foreground" target="_blank" rel="noopener">
          Matiks app ↗
        </a>
      </nav>
    </footer>
  );
}
