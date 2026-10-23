import Link from "next/link";

import { Logo } from "@/components/league/logo";
import { Mascot } from "@/components/league/mascot";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="fade-in w-full max-w-sm space-y-5 text-center">
        <Link href="/" className="inline-block" aria-label="Matiks College League home">
          <Logo />
        </Link>
        <Mascot eager className="mx-auto size-32" />
        <div className="space-y-1">
          <h1 className="text-5xl">Page not found</h1>
          <p className="text-sm text-muted-foreground">This link is broken or the page has moved.</p>
        </div>
        <Button asChild className="h-11">
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </main>
  );
}
