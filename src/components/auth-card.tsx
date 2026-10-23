import { Glass } from "@/components/glass";
import { Logo } from "@/components/league/logo";

/** Centered glass card, used by /login, /reset-password and /no-access. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <Glass variant="strong" className="fade-in w-full max-w-sm space-y-6 p-6 sm:p-8">
        <Logo subtitle={subtitle} />
        {children}
      </Glass>
    </main>
  );
}
