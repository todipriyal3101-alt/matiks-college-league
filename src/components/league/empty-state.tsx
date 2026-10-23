import type { LucideIcon } from "lucide-react";

import { Mascot } from "@/components/league/mascot";
import { cn } from "@/lib/utils";

/** Empty state that always says what to do next (SPEC "UX rules"). `mascot`: public pages only. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  mascot,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  mascot?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-10 text-center",
        className,
      )}
    >
      {mascot ? (
        // Usually the largest thing on screen: load it straight away.
        <Mascot eager className="size-28" />
      ) : (
        <div className="flex size-11 items-center justify-center rounded-xl bg-olive text-primary">
          <Icon className="size-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-display text-2xl tracking-wide uppercase">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
