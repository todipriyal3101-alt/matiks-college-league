import { SigmaIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** "Matiks College League" logo block (Sigma mark). Product name: never "MatiksLined". */
export function Logo({
  subtitle,
  compact,
  className,
}: {
  subtitle?: string;
  /** Mark only (small screens). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="glow flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <SigmaIcon className="size-[18px]" />
      </span>
      <span className={cn("leading-tight", compact && "sr-only")}>
        <span className="block font-display text-sm font-bold">Matiks College League</span>
        {subtitle && (
          <span className="block text-[10px] tracking-wider text-muted-foreground uppercase">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
