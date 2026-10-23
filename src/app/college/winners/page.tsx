import type { Metadata } from "next";
import { Suspense } from "react";

import { CollegeEditor } from "@/components/league/college-editor/college-editor";
import { NeedsRegistration } from "@/components/portal/needs-registration";
import { Skeleton } from "@/components/ui/skeleton";
import { getRegistrationDetail } from "@/lib/data/league-ops";
import { getPocContext, pickRegistration } from "@/lib/data/poc";

export const metadata: Metadata = { title: "Winners" };

/** The existing winners editor in POC mode: the database forces prize fields and locks paid winners. */
export default function PocWinnersPage({ searchParams }: PageProps<"/college/winners">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <Winners searchParams={searchParams} />
    </Suspense>
  );
}

async function Winners({ searchParams }: Pick<PageProps<"/college/winners">, "searchParams">) {
  const [ctx, { r }] = await Promise.all([getPocContext(), searchParams]);
  const selected = ctx && pickRegistration(ctx, r);
  if (!ctx || !selected) return <NeedsRegistration what="Winners" />;
  const detail = await getRegistrationDetail(selected.id);
  if (!detail) return <NeedsRegistration what="Winners" />;
  return <CollegeEditor detail={detail} mode="poc" me={ctx.email} adminNames={{}} sections={["winners"]} />;
}
