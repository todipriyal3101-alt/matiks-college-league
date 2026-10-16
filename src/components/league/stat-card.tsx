import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-5 text-primary" />
        <span className="text-xs tracking-wider uppercase">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
