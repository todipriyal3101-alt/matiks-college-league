"use client";

import { useEffect } from "react";

import { Glass } from "@/components/glass";
import { EmptyStateSticker } from "@/components/stickers";
import { confetti } from "@/lib/confetti";

/** Right after registering: a celebration + "share your link" (the card below it). */
export function SuccessHero({ college }: { college: string }) {
  useEffect(() => {
    const id = setTimeout(() => confetti(), 200);
    return () => clearTimeout(id);
  }, []);
  return (
    <Glass className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
      <EmptyStateSticker name="trophy" className="mx-0 w-24 shrink-0" />
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">You&apos;re registered</p>
        <h1 className="text-5xl">{college} is in the queue!</h1>
        <p className="mt-2 text-foreground/85">
          A Matiks admin reviews it soon. Meanwhile, share your invite link: every batchmate who plays counts, and your college card unlocks once you&apos;re approved.
        </p>
      </div>
    </Glass>
  );
}
