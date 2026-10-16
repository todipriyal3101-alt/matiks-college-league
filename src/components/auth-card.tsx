import { Logo } from "@/components/league/logo";

/** Centered card on the Matiks grid, used by /login, /reset-password and /no-access. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="bg-grid flex min-h-full flex-1 items-center justify-center p-4">
      <div className="fade-in w-full max-w-sm space-y-6 rounded-3xl border bg-card p-6 sm:p-8">
        <Logo subtitle={subtitle} />
        {children}
      </div>
    </main>
  );
}
