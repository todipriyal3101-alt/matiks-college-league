"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { selectLeague } from "@/app/admin/(panel)/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminLeague } from "@/lib/data/admin-leagues";

export function SeasonPicker({ leagues, selectedId }: { leagues: AdminLeague[]; selectedId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (leagues.length === 0) {
    return <span className="text-sm text-muted-foreground">No seasons yet</span>;
  }

  return (
    <Select
      value={selectedId ?? undefined}
      disabled={pending}
      onValueChange={(id) =>
        startTransition(async () => {
          try {
            await selectLeague(id);
            router.refresh();
          } catch {
            toast.error("Couldn't switch season.");
          }
        })
      }
    >
      <SelectTrigger className="w-40 min-w-0 sm:w-56" aria-label="Season">
        <SelectValue placeholder="Select season" />
      </SelectTrigger>
      <SelectContent>
        {leagues.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
            <span className="hidden text-xs text-muted-foreground sm:inline">· {l.status}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
