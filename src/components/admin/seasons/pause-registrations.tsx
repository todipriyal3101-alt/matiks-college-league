"use client";

import { PauseCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setRegistrationsPaused } from "@/app/admin/(panel)/leagues/actions";
import { Glass } from "@/components/glass";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** The one emergency switch for POC self-registration (always open otherwise). Default off. */
export function PauseRegistrations({ paused: initial, isWriter }: { paused: boolean; isWriter: boolean }) {
  const [paused, setPaused] = useState(initial);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setPaused(next);
    startTransition(async () => {
      const res = await setRegistrationsPaused(next);
      if (!res.ok) {
        setPaused(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "New registrations paused" : "Registrations open again", {
        action: { label: "Undo", onClick: () => change(!next) },
      });
    });
  }

  return (
    <Glass className={cn("flex items-start gap-4 p-5", paused && "shadow-[inset_0_0_0_1px_var(--status-pending-fg),var(--glass-edge),var(--glass-drop)]")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", paused ? "bg-status-pending text-status-pending-fg" : "bg-olive text-primary")}>
        <PauseCircleIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor="pause-registrations" className="block font-semibold">
          Pause new registrations
        </label>
        <p className="text-sm text-muted-foreground">
          {paused
            ? "On: POCs see “New registrations are paused. Message us in the Chat tab.” Existing colleges are not affected."
            : "Off: any signed-up POC can register their college (each sets its own dates; you still approve or deny every one). Use only in an emergency."}
        </p>
      </div>
      <Switch
        id="pause-registrations"
        checked={paused}
        disabled={!isWriter || pending}
        onCheckedChange={change}
        className="mt-1"
      />
    </Glass>
  );
}
