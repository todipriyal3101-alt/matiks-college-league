import type { Metadata } from "next";
import { Suspense } from "react";

import { DuelLoader } from "@/components/duel/duel-loader";
import { TopToday } from "@/components/launch/top-today";
import { Skeleton } from "@/components/ui/skeleton";
import { getCollegeRace } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "30-second math duel",
  description: "How many can you solve in 30 seconds? No sign-up. Then challenge your batchmates.",
};

export default function DuelPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Mini duel · no sign-up</p>
          <h1 className="text-5xl sm:text-6xl">30 seconds. How many can you solve?</h1>
        </div>
        <Suspense fallback={<Skeleton className="h-[25rem] w-full rounded-3xl" />}>
          <Duel />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-3xl" />}>
        <TopToday />
      </Suspense>
    </div>
  );
}

async function Duel() {
  const leader = (await getCollegeRace("india"))[0];
  return <DuelLoader eager rival={leader?.name ?? "IIT Bombay"} />;
}
