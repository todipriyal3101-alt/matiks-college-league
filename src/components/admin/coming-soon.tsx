import { requireAdmin } from "@/lib/auth/admin";

/** Placeholder for admin pages built in a later phase. */
export async function ComingSoon({ title, phase }: { title: string; phase: number }) {
  await requireAdmin();
  return (
    <div className="space-y-2">
      <h1 className="text-5xl">{title}</h1>
      <p className="text-sm text-muted-foreground">Coming in phase {phase}.</p>
    </div>
  );
}
