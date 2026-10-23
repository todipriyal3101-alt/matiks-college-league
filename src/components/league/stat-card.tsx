import type { LucideIcon } from "lucide-react";

import { Glass } from "@/components/glass";
import { cn } from "@/lib/utils";

/** Matiks stat tile on glass: small caps label, big Bebas number, lime icon on an olive chip. */
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
    <Glass className={cn("flex min-h-30 flex-col p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">{label}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-olive text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-auto pt-2 font-display text-4xl leading-none tabular-nums sm:text-[2.75rem]">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Glass>
  );
}
