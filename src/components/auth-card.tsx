import { Logo } from "@/components/league/logo";

/** Centered card on the aurora background, used by /login, /reset-password and /no-access. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-full flex-1 items-center justify-center overflow-hidden p-4">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <Logo subtitle={subtitle} />
        {children}
      </div>
    </main>
  );
}
