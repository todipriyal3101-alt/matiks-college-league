import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Matiks stat tile: small caps label, big Bebas number, lime icon on an olive chip. */
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
    <Card className={cn("gap-0 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-olive text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-1 font-display text-4xl leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
