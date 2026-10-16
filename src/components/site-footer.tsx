import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© Matiks. All rights reserved.</p>
        <nav className="flex gap-4">
          <Link href="/colleges" className="hover:text-foreground">
            Colleges
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Register
          </Link>
        </nav>
      </div>
    </footer>
  );
}
